<?php

declare(strict_types=1);

use Twig\Environment;
use Twig\Error\Error as TwigError;
use Twig\Loader\FilesystemLoader;
use Twig\Markup;
use Twig\TwigFunction;

$shortyRoot = dirname(__DIR__, 3);
$runtimeAutoloadPath = $shortyRoot . '/docker/runtime/vendor/autoload.php';
$legacyAutoloadPath = $shortyRoot . '/vendor/autoload.php';
$autoloadPath = is_file($runtimeAutoloadPath) ? $runtimeAutoloadPath : $legacyAutoloadPath;
if (!is_file($autoloadPath)) {
    fwrite(STDERR, "Twig-Abhängigkeit fehlt. Sie wird beim Aufbau des Shorty-Docker-Images aus docker/runtime/composer.lock installiert.\n");
    exit(3);
}

require $autoloadPath;

$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$loader = new FilesystemLoader($input['projectRoot']);
$twig = new Environment($loader, [
    'autoescape' => 'html',
    'strict_variables' => true,
    'cache' => false,
]);

$twig->addFunction(new TwigFunction('component', static function (string $componentId, string $instanceId) use ($twig, $input): Markup {
    if (!isset($input['components'][$componentId]['template'])) {
        throw new RuntimeException("Unbekannter Komponententyp: {$componentId}");
    }

    if (!array_key_exists($instanceId, $input['components'][$componentId]['instances'] ?? [])) {
        throw new RuntimeException("Komponenteninstanz '{$instanceId}' hat keine Seitendaten.");
    }

    $html = $twig->render($input['components'][$componentId]['template'], [
        'data' => $input['components'][$componentId]['instances'][$instanceId],
    ]);
    return new Markup($html, $twig->getCharset());
}));

try {
    $html = $twig->render($input['template'], ['page' => $input['page']]);
    fwrite(STDOUT, $html);
} catch (TwigError | RuntimeException $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
