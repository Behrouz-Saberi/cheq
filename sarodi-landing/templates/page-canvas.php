<?php
/**
 * Full-canvas template for the Sarodi landing: keeps wp_head/wp_footer (SEO plugins,
 * analytics, admin bar) but drops the theme header/footer so the page owns the viewport.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?><!doctype html>
<html <?php language_attributes(); ?> dir="rtl">
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<?php wp_head(); ?>
	<?php $sarodi_lp_d = sarodi_lp_canvas_design(); $sarodi_lp_bgs = array( 'a' => '#05090b', 'b' => '#f1f4f5', 'c' => '#0e0f10' ); ?>
	<style>html,body{margin:0;background:<?php echo esc_html( $sarodi_lp_bgs[ $sarodi_lp_d ] ); ?>}</style>
</head>
<body <?php body_class( 'sarodi-landing-canvas' ); ?>>
<?php
wp_body_open();
while ( have_posts() ) {
	the_post();
	echo sarodi_lp_render( array( 'design' => $sarodi_lp_d ), false ); // phpcs:ignore WordPress.Security.EscapeOutput -- trusted plugin template
	// any extra blocks the editor adds below the landing still render
	$sarodi_lp_extra = trim( get_the_content() );
	if ( $sarodi_lp_extra && ! has_shortcode( $sarodi_lp_extra, 'sarodi_landing' ) ) {
		echo '<div class="sarodi-lp-extra">' . apply_filters( 'the_content', $sarodi_lp_extra ) . '</div>'; // phpcs:ignore
	}
}
wp_footer();
?>
</body>
</html>
