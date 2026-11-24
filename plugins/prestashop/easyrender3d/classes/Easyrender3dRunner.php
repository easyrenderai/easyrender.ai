<?php
if (!defined('_PS_VERSION_')) {
    exit;
}

/**
 * Where the module's products come from: PrestaShop in the shop, a fake in tests.
 * Each product is array('id' => int, 'name' => string, 'image_url' => string).
 */
interface Easyrender3dProductSource
{
    public function products();
}

/** Where each product's easyrender state is kept: a table in the shop, an array in tests. */
interface Easyrender3dStateStore
{
    /** @return string '' when the product has no state yet. */
    public function state($idProduct);

    /** @return string|null */
    public function renderId($idProduct);

    public function save($idProduct, $state, $renderId);
}

/**
 * The module's steps: price the run, queue the products, copy the API's states onto the products.
 * The admin controller and the cron endpoint call these; they hold no PrestaShop code.
 */
class Easyrender3dRunner
{
    const BATCH = 100;
    // States in which a product is done or on its way, so it is not sent again.
    private static $settled = array('ready', 'queued', 'drafting', 'building', 'needs_credits');

    private $client;
    private $source;
    private $store;
    private $storeName;

    public function __construct(Easyrender3dClient $client, Easyrender3dProductSource $source, Easyrender3dStateStore $store, $storeName)
    {
        $this->client = $client;
        $this->source = $source;
        $this->store = $store;
        $this->storeName = strtolower($storeName);
    }

    /** One API item from a product record, or null when it has no https photo. */
    public static function itemFromProduct(array $product)
    {
        $url = (string) $product['image_url'];
        if (strpos($url, 'https://') !== 0) {
            return null;
        }

        $item = array('externalId' => (string) $product['id'], 'title' => (string) $product['name'], 'imageUrl' => $url);
        // The product's size becomes the model's real size in AR. Blank and zero sides are left out.
        $size = array();
        foreach (array('widthCm', 'depthCm', 'heightCm') as $side) {
            $value = isset($product['size_cm'][$side]) ? (float) $product['size_cm'][$side] : 0.0;
            if ($value >= 1 && $value <= 10000) {
                $size[$side] = round($value, 1);
            }
        }
        if ($size) {
            $item['sizeCm'] = $size;
        }

        return $item;
    }

    /** A length typed in the shop's dimension unit, in centimetres. An unknown unit counts as cm. */
    public static function toCm($value, $unit)
    {
        $factors = array('mm' => 0.1, 'cm' => 1, 'm' => 100, 'in' => 2.54, 'ft' => 30.48, 'yd' => 91.44);
        $unit = strtolower(trim((string) $unit));

        return (float) $value * (isset($factors[$unit]) ? $factors[$unit] : 1);
    }

    /** Products that still need a model, as API items, and how many were skipped for lack of a photo. */
    public function collect()
    {
        $items = array();
        $noPhoto = 0;
        foreach ($this->source->products() as $product) {
            if (in_array($this->store->state($product['id']), self::$settled, true)) {
                continue;
            }
            $item = self::itemFromProduct($product);
            if ($item) {
                $items[] = $item;
            } else {
                ++$noPhoto;
            }
        }

        return array('items' => $items, 'no_photo' => $noPhoto);
    }

    /** Copies the API's state onto each product. Returns the summary counts. */
    public function apply(array $response)
    {
        foreach ((array) (isset($response['items']) ? $response['items'] : array()) as $item) {
            $id = (int) (isset($item['externalId']) ? $item['externalId'] : 0);
            if ($id <= 0) {
                continue;
            }
            $state = preg_replace('/[^a-z_]/', '', strtolower((string) (isset($item['state']) ? $item['state'] : '')));
            $render = !empty($item['renderId']) ? preg_replace('/[^A-Za-z0-9_-]/', '', (string) $item['renderId']) : null;
            $this->store->save($id, $state, $render);
        }

        return (array) (isset($response['summary']) ? $response['summary'] : array());
    }

    public static function hasPending(array $summary)
    {
        foreach (array('queued', 'drafting', 'building') as $state) {
            if (!empty($summary[$state])) {
                return true;
            }
        }

        return false;
    }

    /** The button's label: how many products need a model, what that costs, and the balance. */
    public function prepare()
    {
        $collected = $this->collect();
        $count = count($collected['items']);

        return array(
            'count' => $count,
            'noPhoto' => $collected['no_photo'],
            'quote' => $count > 0 ? $this->client->quote($count) : null,
            'summary' => $this->apply($this->client->status($this->storeName)),
        );
    }

    /**
     * Sends the next batch. The browser calls this until `remaining` is 0, passing the credits the
     * merchant saw on the button, so a price that rose in the meantime stops the run.
     */
    public function submit($isFirst, $approvedCredits)
    {
        $items = $this->collect()['items'];
        $perModel = 1;
        if (count($items) > 0) {
            $quote = $this->client->quote(count($items));
            $perModel = max(1, (int) $quote['creditsPerModel']);
            if ($isFirst && (int) $quote['totalCredits'] > (int) $approvedCredits) {
                throw new Easyrender3dError('The price changed. Reload the page and check it again.', 409, 'quote_changed');
            }
        }
        $batch = array_slice($items, 0, self::BATCH);
        if (count($batch) > 0) {
            $this->client->submit($this->storeName, $batch, count($batch) * $perModel);
            // Keep these out of the next batch; the next sync replaces this with the server's state.
            foreach ($batch as $item) {
                $this->store->save((int) $item['externalId'], 'queued', null);
            }
        }

        return array('sent' => count($batch), 'remaining' => max(0, count($items) - count($batch)));
    }

    public function sync()
    {
        return $this->apply($this->client->status($this->storeName));
    }

    /** The AR page and QR URLs of a product with a finished model, else null. */
    public static function links($state, $renderId, $base)
    {
        if ($state !== 'ready' || $renderId === null || $renderId === '') {
            return null;
        }
        $base = rtrim($base, '/');

        return array(
            'ar' => $base . '/ar/' . rawurlencode($renderId),
            'qr' => $base . '/api/renders/' . rawurlencode($renderId) . '/qr',
        );
    }
}
