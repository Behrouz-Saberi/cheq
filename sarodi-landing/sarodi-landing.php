<?php
/**
 * Plugin Name: Sarodi Smart Switch Landing
 * Description: لندینگ سه‌بعدی و تعاملی کلیدهای هوشمند سارودی. استفاده: شورت‌کد [sarodi_landing] یا قالب برگه «Sarodi Landing (تمام‌صفحه)».
 * Version:     1.2.0
 * Author:      Imenab Digital Marketing
 * Text Domain: sarodi-landing
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SARODI_LP_VER', '1.2.0' );
define( 'SARODI_LP_DIR', plugin_dir_path( __FILE__ ) );
define( 'SARODI_LP_URL', plugin_dir_url( __FILE__ ) );

/**
 * Render the landing markup.
 *
 * Attributes:
 *  cta – link for every «استعلام قیمت» button (default: #slp-contact)
 *  tel – phone link (default: tel:03133120)
 *  nav – "1" shows the landing's own top bar inside a theme page (default "0": the theme header is used)
 *
 * $embedded = true when rendered inside a theme page (shortcode / Elementor): the landing
 * breaks out to full width and drops its fixed nav. The full-canvas template passes false.
 */
function sarodi_lp_render( $atts = array(), $embedded = true ) {
	$atts = shortcode_atts(
		array(
			'cta' => '#slp-contact',
			'tel' => 'tel:03133120',
			'nav' => '0',
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

	$html = file_get_contents( SARODI_LP_DIR . 'templates/landing.html' );
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
	return 'sarodi-landing-canvas' === get_page_template_slug( $post ) || has_shortcode( $post->post_content, 'sarodi_landing' );
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
		echo '<meta name="theme-color" content="#05090b">' . "\n";
	},
	1
);

/* Full-canvas page template (no theme header/footer). */
add_filter(
	'theme_page_templates',
	function ( $templates ) {
		$templates['sarodi-landing-canvas'] = 'Sarodi Landing (تمام‌صفحه)';
		return $templates;
	}
);

add_filter(
	'template_include',
	function ( $template ) {
		if ( is_singular() && 'sarodi-landing-canvas' === get_page_template_slug( get_queried_object_id() ) ) {
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
