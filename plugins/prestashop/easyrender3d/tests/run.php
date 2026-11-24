<?php
/**
 * Plain-PHP tests for the module's logic: the API client and the runner that prices, batches and
 * records states. PrestaShop itself is not loaded, so the product query, hooks and templates are
 * not covered here (see the README for what that leaves unverified).
 * Run: php plugins/prestashop/easyrender3d/tests/run.php
 */

define('_PS_VERSION_', '8.1.0');

require dirname(__DIR__) . '/classes/Easyrender3dClient.php';
require dirname(__DIR__) . '/classes/Easyrender3dRunner.php';

$failures = 0;
function check($name, $ok, $detail = '')
{
    global $failures;
    echo ($ok ? 'ok   ' : 'FAIL ') . $name . ($ok ? '' : ' ' . var_export($detail, true)) . "\n";
    if (!$ok) {
        ++$failures;
    }
}

class FakeProducts implements Easyrender3dProductSource
{
    public $list = array();

    public function products()
    {
        return $this->list;
    }
}

class FakeState implements Easyrender3dStateStore
{
    public $rows = array();

    public function state($id)
    {
        return isset($this->rows[$id]) ? $this->rows[$id]['state'] : '';
    }

    public function renderId($id)
    {
        return isset($this->rows[$id]) ? $this->rows[$id]['render'] : null;
    }

    public function save($id, $state, $render)
    {
        $this->rows[$id] = array('state' => $state, 'render' => $render);
    }
}

function fakeHttp(&$calls, $perModel = 64)
{
    return function ($method, $url, $headers, $body) use (&$calls, $perModel) {
        $calls[] = array($method, $url, $headers, $body);
        if (strpos($url, '/api/catalog/quote') !== false) {
            preg_match('/items=(\d+)/', $url, $m);

            return array('status' => 200, 'body' => json_encode(array('creditsPerModel' => $perModel, 'totalCredits' => $perModel * (int) $m[1])));
        }
        if ($method === 'GET') {
            return array('status' => 200, 'body' => json_encode(array(
                'summary' => array('total' => 2, 'ready' => 1, 'building' => 1),
                'items' => array(
                    array('externalId' => '1', 'state' => 'ready', 'renderId' => 'r_abc'),
                    array('externalId' => '2', 'state' => 'building', 'renderId' => 'r_def'),
                ),
            )));
        }

        return array('status' => 202, 'body' => '{"queued":1}');
    };
}

// --- client -----------------------------------------------------------------------------------
$calls = array();
$client = new Easyrender3dClient('https://easyrender.test/', 'er_key', fakeHttp($calls));
$client->submit('shop.example.com', array(array('externalId' => '1')), 64);
$body = json_decode($calls[0][3], true);
check('submit posts to the API without a double slash', $calls[0][0] === 'POST' && $calls[0][1] === 'https://easyrender.test/api/catalog', $calls[0][1]);
check('submit sends the key as a bearer token', in_array('Authorization: Bearer er_key', $calls[0][2], true));
check('submit sends platform, store, approved credits and items', $body['platform'] === 'prestashop' && $body['store'] === 'shop.example.com' && $body['maxCredits'] === 64 && $body['items'][0]['externalId'] === '1', $body);
$status = $client->status('shop.example.com');
check('status asks for this platform and store', $calls[1][1] === 'https://easyrender.test/api/catalog?platform=prestashop&store=shop.example.com', $calls[1][1]);
check('status returns the decoded body', $status['summary']['ready'] === 1);
try {
    $failing = new Easyrender3dClient('https://x', 'k', function () {
        return array('status' => 409, 'body' => '{"error":"This run costs 64 credits","code":"quote_changed"}');
    });
    $failing->submit('s', array(), 1);
    check('an API error throws', false);
} catch (Easyrender3dError $e) {
    check('an API error carries its message, status and code', $e->getCode() === 409 && $e->errorCode === 'quote_changed' && strpos($e->getMessage(), '64 credits') !== false, $e->getMessage());
}
try {
    $none = new Easyrender3dClient('https://x', '');
    $none->status('s');
    check('no key throws', false);
} catch (Easyrender3dError $e) {
    check('no key is refused before any request', $e->getCode() === 401);
}

// --- runner -----------------------------------------------------------------------------------
function makeRunner(&$calls, $products, $state = null, $perModel = 64)
{
    $source = new FakeProducts();
    $source->list = $products;
    $state = $state ?: new FakeState();

    return array(new Easyrender3dRunner(new Easyrender3dClient('https://easyrender.test', 'k', fakeHttp($calls, $perModel)), $source, $state, 'Shop.Example.com'), $state);
}

check('a product without an https photo has no item', Easyrender3dRunner::itemFromProduct(array('id' => 1, 'name' => 'A', 'image_url' => 'http://x/a.jpg')) === null);
check('a product with an https photo becomes an item', Easyrender3dRunner::itemFromProduct(array('id' => 5, 'name' => 'Chair', 'image_url' => 'https://x/a.jpg')) === array('externalId' => '5', 'title' => 'Chair', 'imageUrl' => 'https://x/a.jpg'));
$sized = Easyrender3dRunner::itemFromProduct(array('id' => 5, 'name' => 'Chair', 'image_url' => 'https://x/a.jpg', 'size_cm' => array('widthCm' => 50.04, 'depthCm' => 0, 'heightCm' => 90)));
check('a product size becomes sizeCm, without the blank sides', $sized['sizeCm'] === array('widthCm' => 50.0, 'heightCm' => 90.0));
check('inches and millimetres become centimetres', Easyrender3dRunner::toCm(10, 'in') === 25.4 && Easyrender3dRunner::toCm(250, 'mm') === 25.0 && Easyrender3dRunner::toCm(3, 'cm') === 3.0 && Easyrender3dRunner::toCm(3, 'furlong') === 3.0);

$products = array(
    array('id' => 1, 'name' => 'Ready', 'image_url' => 'https://x/1.jpg'),
    array('id' => 2, 'name' => 'Waiting', 'image_url' => 'https://x/2.jpg'),
    array('id' => 3, 'name' => 'New', 'image_url' => 'https://x/3.jpg'),
    array('id' => 4, 'name' => 'Failed before', 'image_url' => 'https://x/4.jpg'),
    array('id' => 5, 'name' => 'No photo', 'image_url' => ''),
);
$calls = array();
$state = new FakeState();
$state->save(1, 'ready', 'r1');
$state->save(2, 'building', 'r2');
$state->save(4, 'failed', null);
list($runner) = makeRunner($calls, $products, $state);
$collected = $runner->collect();
$ids = array_map(function ($i) {
    return $i['externalId'];
}, $collected['items']);
check('collect skips finished and in-progress products, retries failed ones', $ids === array('3', '4'), $ids);
check('collect counts products without a photo', $collected['no_photo'] === 1, $collected);

$calls = array();
list($runner, $state) = makeRunner($calls, $products, $state);
$prepared = $runner->prepare();
check('prepare shows the count and the total price of the run', $prepared['count'] === 2 && $prepared['quote']['totalCredits'] === 128, $prepared);
check('prepare uses the lower-cased shop name for the status call', strpos($calls[count($calls) - 1][1], 'store=shop.example.com') !== false, $calls);
check('prepare copies the server states onto the products', $state->state(1) === 'ready' && $state->renderId(1) === 'r_abc' && $state->state(2) === 'building');

// Batching: 250 products go out as 100 + 100 + 50, each with the credits for its own batch.
$many = array();
for ($i = 1; $i <= 250; ++$i) {
    $many[] = array('id' => $i, 'name' => 'P' . $i, 'image_url' => 'https://x/' . $i . '.jpg');
}
$calls = array();
list($runner, $state) = makeRunner($calls, $many);
$sizes = array();
$credits = array();
$first = true;
do {
    $result = $runner->submit($first, 250 * 64);
    $first = false;
    $posts = array_values(array_filter($calls, function ($c) {
        return $c[0] === 'POST';
    }));
    $last = json_decode($posts[count($posts) - 1][3], true);
    $sizes[] = $result['sent'];
    $credits[] = $last['maxCredits'];
} while ($result['remaining'] > 0);
check('submit sends 250 products in batches of 100, 100 and 50', $sizes === array(100, 100, 50), $sizes);
check('each batch approves the credits for its own products', $credits === array(6400, 6400, 3200), $credits);
check('every submitted product is marked queued so it is not sent twice', $state->state(1) === 'queued' && $state->state(250) === 'queued');
check('no product is sent twice', count(array_filter($calls, function ($c) {
    return $c[0] === 'POST';
})) === 3);

// A price above what the owner saw stops the run before anything is queued.
$calls = array();
list($runner, $state) = makeRunner($calls, $many, null, 80);
try {
    $runner->submit(true, 250 * 64);
    check('a higher price stops the run', false);
} catch (Easyrender3dError $e) {
    check('a higher price stops the run with quote_changed', $e->errorCode === 'quote_changed' && $e->getCode() === 409);
}
check('nothing is queued when the price changed', $state->state(1) === '' && count(array_filter($calls, function ($c) {
    return $c[0] === 'POST';
})) === 0);

// States from the API are sanitised before they are stored.
$state = new FakeState();
list($runner) = makeRunner($calls, array(), $state);
$runner->apply(array('items' => array(array('externalId' => '9', 'state' => 'Ready<script>', 'renderId' => 'r_1"><x'))));
check('state and render id are sanitised', $state->state(9) === 'readyscript' && $state->renderId(9) === 'r_1x', $state->rows);
check('pending states are detected', Easyrender3dRunner::hasPending(array('building' => 2)) && !Easyrender3dRunner::hasPending(array('ready' => 5)));

// --- links ------------------------------------------------------------------------------------
$links = Easyrender3dRunner::links('ready', 'r_abc', 'https://easyrender.test/');
check('a ready product links to the AR page and the QR image', $links['ar'] === 'https://easyrender.test/ar/r_abc' && $links['qr'] === 'https://easyrender.test/api/renders/r_abc/qr', $links);
check('a product still building shows no links', Easyrender3dRunner::links('building', 'r_abc', 'https://easyrender.test') === null);
check('a ready product without a render id shows no links', Easyrender3dRunner::links('ready', null, 'https://easyrender.test') === null);

echo $failures ? "\n$failures failed\n" : "\nall passed\n";
exit($failures ? 1 : 0);
