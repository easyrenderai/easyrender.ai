<?php
if (!defined('_PS_VERSION_')) {
    exit;
}

require_once dirname(__FILE__) . '/Easyrender3dClient.php';
require_once dirname(__FILE__) . '/Easyrender3dRunner.php';

/** Reads the shop's active products and their cover photo with one query. */
class Easyrender3dDbProducts implements Easyrender3dProductSource
{
    public function products()
    {
        $context = Context::getContext();
        $idShop = (int) $context->shop->id;
        $idLang = (int) $context->language->id;
        $link = $context->link;
        $rows = Db::getInstance()->executeS(
            'SELECT p.`id_product`, p.`width`, p.`depth`, p.`height`, pl.`name`, pl.`link_rewrite`, i.`id_image`
             FROM `' . _DB_PREFIX_ . 'product` p
             INNER JOIN `' . _DB_PREFIX_ . 'product_shop` ps ON (ps.`id_product` = p.`id_product` AND ps.`id_shop` = ' . $idShop . ' AND ps.`active` = 1)
             INNER JOIN `' . _DB_PREFIX_ . 'product_lang` pl ON (pl.`id_product` = p.`id_product` AND pl.`id_shop` = ' . $idShop . ' AND pl.`id_lang` = ' . $idLang . ')
             LEFT JOIN `' . _DB_PREFIX_ . 'image_shop` ish ON (ish.`id_product` = p.`id_product` AND ish.`id_shop` = ' . $idShop . ' AND ish.`cover` = 1)
             LEFT JOIN `' . _DB_PREFIX_ . 'image` i ON (i.`id_image` = ish.`id_image`)
             ORDER BY p.`id_product` ASC'
        );
        $unit = (string) Configuration::get('PS_DIMENSION_UNIT');
        $products = array();
        foreach ((array) $rows as $row) {
            $url = '';
            if (!empty($row['id_image'])) {
                $url = (string) $link->getImageLink($row['link_rewrite'], (int) $row['id_image'], ImageType::getFormattedName('large'));
                // getImageLink can return a protocol-relative URL; the API only fetches https.
                if (strpos($url, '//') === 0) {
                    $url = 'https:' . $url;
                }
            }
            $products[] = array(
                'id' => (int) $row['id_product'],
                'name' => (string) $row['name'],
                'image_url' => $url,
                'size_cm' => array(
                    'widthCm' => Easyrender3dRunner::toCm($row['width'], $unit),
                    'depthCm' => Easyrender3dRunner::toCm($row['depth'], $unit),
                    'heightCm' => Easyrender3dRunner::toCm($row['height'], $unit),
                ),
            );
        }

        return $products;
    }
}

/** Keeps each product's easyrender state in the module's own table. */
class Easyrender3dDbState implements Easyrender3dStateStore
{
    private $cache = null;

    private function load()
    {
        if ($this->cache === null) {
            $this->cache = array();
            foreach ((array) Db::getInstance()->executeS('SELECT `id_product`, `state`, `render_id` FROM `' . _DB_PREFIX_ . 'easyrender3d_product`') as $row) {
                $this->cache[(int) $row['id_product']] = $row;
            }
        }

        return $this->cache;
    }

    public function state($idProduct)
    {
        $all = $this->load();

        return isset($all[(int) $idProduct]) ? (string) $all[(int) $idProduct]['state'] : '';
    }

    public function renderId($idProduct)
    {
        $all = $this->load();

        return isset($all[(int) $idProduct]) && $all[(int) $idProduct]['render_id'] ? (string) $all[(int) $idProduct]['render_id'] : null;
    }

    public function save($idProduct, $state, $renderId)
    {
        $this->load();
        Db::getInstance()->execute(
            'REPLACE INTO `' . _DB_PREFIX_ . 'easyrender3d_product` (`id_product`, `state`, `render_id`, `date_upd`) VALUES ('
            . (int) $idProduct . ", '" . pSQL($state) . "', " . ($renderId === null ? 'NULL' : "'" . pSQL($renderId) . "'") . ", '" . pSQL(date('Y-m-d H:i:s')) . "')"
        );
        $this->cache[(int) $idProduct] = array('id_product' => (int) $idProduct, 'state' => $state, 'render_id' => $renderId);
    }
}

class Easyrender3dFactory
{
    const DEFAULT_BASE = 'https://easyrender.ai';

    public static function client()
    {
        $base = (string) Configuration::get('EASYRENDER3D_API_URL');

        return new Easyrender3dClient($base !== '' ? $base : self::DEFAULT_BASE, (string) Configuration::get('EASYRENDER3D_API_KEY'));
    }

    public static function storeName()
    {
        return strtolower((string) Tools::getShopDomain(false));
    }

    public static function runner()
    {
        return new Easyrender3dRunner(self::client(), new Easyrender3dDbProducts(), new Easyrender3dDbState(), self::storeName());
    }

    /** The secret in the background-sync URL. Derived from the API key, so rotating the key rotates it. */
    public static function cronToken()
    {
        return substr(hash('sha256', 'easyrender3d|' . (string) Configuration::get('EASYRENDER3D_API_KEY') . '|' . _COOKIE_KEY_), 0, 32);
    }
}
