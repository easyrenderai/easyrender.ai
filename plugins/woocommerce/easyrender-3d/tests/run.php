<?php
/**
 * Plain-PHP tests for the plugin's logic, with the few WordPress functions it uses stubbed.
 * Run: php plugins/woocommerce/easyrender-3d/tests/run.php
 * They do not load WordPress or WooCommerce; see the README for what that leaves unverified.
 */

define( 'ABSPATH', __DIR__ );
define( 'EASYRENDER_3D_FILE', dirname( __DIR__ ) . '/easyrender-3d.php' );
define( 'EASYRENDER_3D_VERSION', 'test' );

$GLOBALS['options'] = array();
$GLOBALS['meta']    = array();

function wp_json_encode( $v ) { return json_encode( $v ); }
function get_option( $k, $d = false ) { return $GLOBALS['options'][ $k ] ?? $d; }
function update_option( $k, $v ) { $GLOBALS['options'][ $k ] = $v; return true; }
function get_post_meta( $id, $k, $single = false ) { return $GLOBALS['meta'][ $id ][ $k ] ?? ''; }
function update_post_meta( $id, $k, $v ) { $GLOBALS['meta'][ $id ][ $k ] = $v; return true; }
function delete_post_meta( $id, $k ) { unset( $GLOBALS['meta'][ $id ][ $k ] ); return true; }
function sanitize_key( $s ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( $s ) ); }
function sanitize_text_field( $s ) { return trim( strip_tags( $s ) ); }
function wp_parse_url( $u, $c = -1 ) { return parse_url( $u, $c ); }
function home_url() { return 'https://Shop.Example.com/store'; }
function esc_url( $u ) { return htmlspecialchars( $u, ENT_QUOTES ); }
function esc_html__( $s ) { return htmlspecialchars( $s, ENT_QUOTES ); }
function esc_attr__( $s ) { return htmlspecialchars( $s, ENT_QUOTES ); }
function plugins_url( $p ) { return 'https://shop.example.com/wp-content/plugins/easyrender-3d/' . $p; }
function get_the_ID() { return 7; }
function shortcode_atts( $d, $a ) { return array_merge( $d, (array) $a ); }
function add_action() {}
function __( $s ) { return $s; }
function add_shortcode() {}
function add_filter() {}

require dirname( __DIR__ ) . '/includes/class-easyrender-client.php';
require dirname( __DIR__ ) . '/includes/class-easyrender-catalog.php';
require dirname( __DIR__ ) . '/includes/class-easyrender-frontend.php';

$failures = 0;
function check( string $name, bool $ok, $detail = '' ) {
	global $failures;
	echo ( $ok ? 'ok   ' : 'FAIL ' ) . $name . ( $ok ? '' : ' ' . var_export( $detail, true ) ) . "\n";
	if ( ! $ok ) {
		++$failures;
	}
}

// --- client ---------------------------------------------------------------------------------
$calls  = array();
$client = new Easyrender_Client(
	'https://easyrender.test/',
	'er_key',
	function ( $method, $url, $args ) use ( &$calls ) {
		$calls[] = array( $method, $url, $args );
		if ( 409 === ( $GLOBALS['force'] ?? 0 ) ) {
			return array( 'status' => 409, 'body' => '{"error":"This run costs 64 credits","code":"quote_changed"}' );
		}
		return array( 'status' => 202, 'body' => '{"queued":1}' );
	}
);
$result = $client->submit( 'shop.example.com', array( array( 'externalId' => '1' ) ), 64 );
check( 'submit returns the decoded body', 1 === $result['queued'], $result );
check( 'submit sends the key as a bearer token', 'Bearer er_key' === $calls[0][2]['headers']['Authorization'] );
check( 'submit posts to the API without a double slash', 'https://easyrender.test/api/catalog' === $calls[0][1], $calls[0][1] );
$body = json_decode( $calls[0][2]['body'], true );
check( 'submit sends platform, store, approved credits and items', 'woocommerce' === $body['platform'] && 'shop.example.com' === $body['store'] && 64 === $body['maxCredits'] && '1' === $body['items'][0]['externalId'], $body );
$GLOBALS['force'] = 409;
try {
	$client->submit( 's', array(), 1 );
	check( 'an API error throws', false );
} catch ( Easyrender_Error $e ) {
	check( 'an API error carries its message, status and code', 409 === $e->getCode() && 'quote_changed' === $e->error_code && false !== strpos( $e->getMessage(), '64 credits' ), $e->getMessage() );
}
try {
	( new Easyrender_Client( 'https://x', '' ) )->status( 's' );
	check( 'no key throws', false );
} catch ( Easyrender_Error $e ) {
	check( 'no key is refused before any request', 401 === $e->getCode() );
}

// --- catalogue mapping ------------------------------------------------------------------------
check( 'store is the lowercase host', 'shop.example.com' === Easyrender_Catalog::store(), Easyrender_Catalog::store() );
check( 'a product with an http photo is skipped', null === Easyrender_Catalog::item_from_product( array( 'id' => 1, 'name' => 'A', 'image_url' => 'http://x/a.jpg' ) ) );
check( 'a product with no photo is skipped', null === Easyrender_Catalog::item_from_product( array( 'id' => 1, 'name' => 'A', 'image_url' => '' ) ) );
$item = Easyrender_Catalog::item_from_product( array( 'id' => 12, 'name' => 'Oak chair', 'image_url' => 'https://x/a.jpg' ) );
check( 'a product with an https photo becomes an item', array( 'externalId' => '12', 'title' => 'Oak chair', 'imageUrl' => 'https://x/a.jpg' ) === $item, $item );
$sized = Easyrender_Catalog::item_from_product( array( 'id' => 12, 'name' => 'Oak chair', 'image_url' => 'https://x/a.jpg', 'size_cm' => array( 'widthCm' => 50.04, 'depthCm' => 0, 'heightCm' => 90 ) ) );
check( 'a product size becomes sizeCm, without the blank sides', array( 'widthCm' => 50.0, 'heightCm' => 90.0 ) === ( $sized['sizeCm'] ?? null ), $sized );
check( 'a product with every side blank sends no size', ! isset( Easyrender_Catalog::item_from_product( array( 'id' => 1, 'name' => 'A', 'image_url' => 'https://x/a.jpg', 'size_cm' => array( 'widthCm' => 0, 'depthCm' => 0, 'heightCm' => 0 ) ) )['sizeCm'] ) );

$summary = Easyrender_Catalog::apply(
	array(
		'items'   => array(
			array( 'externalId' => '12', 'state' => 'ready', 'renderId' => 'rnd1' ),
			array( 'externalId' => '13', 'state' => 'drafting', 'renderId' => 'rnd2' ),
			array( 'externalId' => '14', 'state' => 'needs_info', 'renderId' => null ),
			array( 'externalId' => 'abc', 'state' => 'ready', 'renderId' => 'zzz' ),
		),
		'summary' => array( 'total' => 3, 'ready' => 1, 'drafting' => 1, 'needs_info' => 1 ),
	)
);
check( 'apply stores state and render id on the product', 'ready' === get_post_meta( 12, '_easyrender_state' ) && 'rnd1' === get_post_meta( 12, '_easyrender_render_id' ) );
check( 'apply clears the render id when the API has none', '' === get_post_meta( 14, '_easyrender_render_id' ) && 'needs_info' === get_post_meta( 14, '_easyrender_state' ) );
check( 'apply ignores an id that is not a product', ! isset( $GLOBALS['meta']['abc'] ) && ! isset( $GLOBALS['meta'][0] ) );
check( 'apply returns and keeps the summary', 1 === $summary['ready'] && 1 === get_option( 'easyrender_summary' )['drafting'] );
check( 'work in progress counts as pending', Easyrender_Catalog::has_pending( $summary ) );
check( 'finished or stuck work is not pending', ! Easyrender_Catalog::has_pending( array( 'ready' => 5, 'needs_info' => 2, 'needs_credits' => 1 ) ) );

// --- shopper block ----------------------------------------------------------------------------
$links = Easyrender_Catalog::links( 12, 'https://easyrender.test/' );
check( 'a ready product links to its AR page and QR code', 'https://easyrender.test/ar/rnd1' === $links['ar'] && 'https://easyrender.test/api/renders/rnd1/qr' === $links['qr'], $links );
check( 'a product still building has no links', null === Easyrender_Catalog::links( 13, 'https://easyrender.test' ) );
$html = Easyrender_Frontend::html( 12 );
check( 'the block shows the button and the QR code', false !== strpos( $html, '/ar/rnd1' ) && false !== strpos( $html, '/qr' ) && false !== strpos( $html, 'View in your room' ), $html );
check( 'the block is empty until the model is ready', '' === Easyrender_Frontend::html( 13 ) );
update_post_meta( 12, '_easyrender_render_id', 'x"><script>' );
check( 'a hostile render id cannot break out of the markup', false === strpos( Easyrender_Frontend::html( 12 ), '<script>' ) );

// --- products list column --------------------------------------------------------------------
check( 'a ready product is labelled 3D ready', '3D ready' === Easyrender_Catalog::state_label( 'ready' ) );
check( 'queued, drafting and building all read as in progress', 'In progress' === Easyrender_Catalog::state_label( 'queued' ) && 'In progress' === Easyrender_Catalog::state_label( 'drafting' ) && 'In progress' === Easyrender_Catalog::state_label( 'building' ) );
check( 'stuck states say why', 'Waiting for credits' === Easyrender_Catalog::state_label( 'needs_credits' ) && 'Needs a usable photo' === Easyrender_Catalog::state_label( 'needs_info' ) && 'Failed, will retry' === Easyrender_Catalog::state_label( 'failed' ) );
check( 'a product never sent has no label', '' === Easyrender_Catalog::state_label( '' ) );

// The automatic placements show the block once per product, even if both fire.
check( 'the block shows once when two placements fire for the same product', false !== strpos( Easyrender_Frontend::once( 12 ), 'easyrender-ar' ) && '' === Easyrender_Frontend::once( 12 ) );
check( 'a product with no model never marks itself as shown', '' === Easyrender_Frontend::once( 13 ) && '' === Easyrender_Frontend::once( 13 ) );

echo $failures ? "\n$failures failed\n" : "\nall passed\n";
exit( $failures ? 1 : 0 );
