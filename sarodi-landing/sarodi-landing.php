<?php
/**
 * Plugin Name: Sarodi Smart Switch Landing
 * Description: لندینگ سه‌بعدی و تعاملی کلیدهای هوشمند سارودی. استفاده: شورت‌کد [sarodi_landing] یا قالب برگه «Sarodi Landing (تمام‌صفحه)».
 * Version:     1.3.0
 * Author:      Imenab Digital Marketing
 * Text Domain: sarodi-landing
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SARODI_LP_VER', '1.3.0' );
define( 'SARODI_LP_DIR', plugin_dir_path( __FILE__ ) );
define( 'SARODI_LP_URL', plugin_dir_url( __FILE__ ) );

/**
 * Render the landing markup.
 *
 * Attributes:
 *  cta – link for every «استعلام قیمت» button (default: #slp-contact)
 *  tel – phone link (default: tel:03133120)
 *  nav – "1" shows the landing's own top bar inside a theme page (default "0": the theme header is used)
 *  design – "a" (default, dark scroll story), "b" (Atelier, light) or "c" (Control Center, bento)
 *
 * $embedded = true when rendered inside a theme page (shortcode / Elementor): the landing
 * breaks out to full width and drops its fixed nav. The full-canvas template passes false.
 */
function sarodi_lp_render( $atts = array(), $embedded = true ) {
	$atts = shortcode_atts(
		array(
			'cta'    => '#slp-contact',
			'tel'    => 'tel:03133120',
			'nav'    => '0',
			'design' => 'a',
		),
		$atts,
		'sarodi_landing'
	);
	$cls = '';
	if ( $embedded ) {
		$cls .= ' slp--embed alignfull';
		if ( '1' !== (string) $atts['nav'] ) {
			$cls .= ' slp--nonav';
		}
	}

	wp_enqueue_style( 'sarodi-landing', SARODI_LP_URL . 'assets/css/landing.css', array(), SARODI_LP_VER );

	$files  = array( 'a' => 'landing.html', 'b' => 'landing-b.html', 'c' => 'landing-c.html' );
	$design = isset( $files[ $atts['design'] ] ) ? $atts['design'] : 'a';
	$html   = file_get_contents( SARODI_LP_DIR . 'templates/' . $files[ $design ] );
	if ( false === $html ) {
		return '';
	}

	$assets = untrailingslashit( SARODI_LP_URL . 'assets' );
	$html   = strtr(
		$html,
		array(
			'{{A}}'   => esc_url( $assets ),
			'{{CTA}}' => esc_url( $atts['cta'] ),
			'{{TEL}}' => esc_url( $atts['tel'], array( 'tel', 'http', 'https' ) ),
			'{{CLS}}' => esc_attr( $cls ),
		)
	);

	// cache-bust the ES module entry
	$html = str_replace( '/js/sarodi.bundle.js"', '/js/sarodi.bundle.js?ver=' . SARODI_LP_VER . '"', $html );

	return $html;
}
add_shortcode(
	'sarodi_landing',
	function ( $atts ) {
		return sarodi_lp_render( (array) $atts, true );
	}
);

/* Is the current request a page that shows the landing? */
function sarodi_lp_is_landing() {
	if ( ! is_singular() ) {
		return false;
	}
	$post = get_post();
	if ( ! $post ) {
		return false;
	}
	return 0 === strpos( (string) get_page_template_slug( $post ), 'sarodi-landing-canvas' ) || has_shortcode( $post->post_content, 'sarodi_landing' );
}

/* Which design the current canvas page uses (a / b / c). */
function sarodi_lp_canvas_design() {
	$slug = (string) get_page_template_slug( get_queried_object_id() );
	if ( 'sarodi-landing-canvas-b' === $slug ) {
		return 'b';
	}
	return 'sarodi-landing-canvas-c' === $slug ? 'c' : 'a';
}

/* Enqueue CSS in <head> (no flash of unstyled content). */
add_action(
	'wp_enqueue_scripts',
	function () {
		if ( sarodi_lp_is_landing() ) {
			wp_enqueue_style( 'sarodi-landing', SARODI_LP_URL . 'assets/css/landing.css', array(), SARODI_LP_VER );
		}
	}
);

/* Preload the variable font + entry module on pages that use the landing. */
add_action(
	'wp_head',
	function () {
		if ( ! sarodi_lp_is_landing() ) {
			return;
		}
		echo '<link rel="preload" href="' . esc_url( SARODI_LP_URL . 'assets/fonts/Vazirmatn-wght.woff2' ) . '" as="font" type="font/woff2" crossorigin>' . "\n";
		echo '<link rel="preload" href="' . esc_url( SARODI_LP_URL . 'assets/js/sarodi.bundle.js?ver=' . SARODI_LP_VER ) . '" as="script">' . "\n";
		$sarodi_lp_bg = array( 'a' => '#05090b', 'b' => '#f1f4f5', 'c' => '#0e0f10' );
		echo '<meta name="theme-color" content="' . esc_attr( $sarodi_lp_bg[ sarodi_lp_canvas_design() ] ) . '">' . "\n";
	},
	1
);

/* Full-canvas page template (no theme header/footer). */
add_filter(
	'theme_page_templates',
	function ( $templates ) {
		$templates['sarodi-landing-canvas']   = 'Sarodi Landing A (تمام‌صفحه، تیره)';
		$templates['sarodi-landing-canvas-b'] = 'Sarodi Landing B (تمام‌صفحه، روشن)';
		$templates['sarodi-landing-canvas-c'] = 'Sarodi Landing C (تمام‌صفحه، بنتو)';
		return $templates;
	}
);

add_filter(
	'template_include',
	function ( $template ) {
		if ( is_singular() && 0 === strpos( (string) get_page_template_slug( get_queried_object_id() ), 'sarodi-landing-canvas' ) ) {
			return SARODI_LP_DIR . 'templates/page-canvas.php';
		}
		return $template;
	}
);

/* Keep optimisation plugins from re-bundling or delaying the 3D bundle (it must run on load).
   Only touches pages that show the landing; every other page (home, sliders, shop) keeps
   the cache plugin's settings exactly as they were. */
foreach ( array( 'autoptimize_filter_js_exclude', 'litespeed_optm_js_defer_exc', 'rocket_exclude_js', 'rocket_delay_js_exclusions' ) as $sarodi_lp_hook ) {
	add_filter(
		$sarodi_lp_hook,
		function ( $excluded ) {
			if ( ! did_action( 'wp' ) || ! sarodi_lp_is_landing() ) {
				return $excluded;
			}
			$needle = 'sarodi-landing/assets/js/';
			if ( is_string( $excluded ) ) {
				return '' === trim( $excluded ) ? $needle : rtrim( $excluded, " ,\n" ) . ', ' . $needle;
			}
			if ( is_array( $excluded ) ) {
				$excluded[] = $needle;
			}
			return $excluded;
		}
	);
}
