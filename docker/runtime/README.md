# Shorty Docker Runtime Image

The Dockerfile in this directory builds Shorty's local runtime image. The normal `shorty image build` command uses the installed Shorty package as its build context; it does not copy the active website project into the image and does not pull or publish an image. The image tag is tied to the installed Shorty version and Git commit. Images are rebuilt only after the explicit `shorty image build` command; normal `validate`, `build`, and `serve` commands do not update them.

## Runtime toolchain

- Node.js `24.22.2` and npm `12.2.2` are installed in the image.
- PHP `8.5.12` runs the Twig worker.
- `package.json` and `package-lock.json` pin the container-side AJV and Sass dependencies.
- `composer.json` and `composer.lock` pin Twig and its PHP dependencies.
- Composer `2.11.1` is downloaded only during image construction. `scripts/prepare.js` verifies its SHA-256 checksum, installs the locked Composer dependencies without development packages, and checks Twig's autoloader.
- The final runtime runs as UID/GID `1000:1000` and receives the website project as a host bind mount. Generated output is written to that host project.

The PHP worker loads the Composer autoloader from `docker/runtime/vendor/autoload.php` in the image.

## Build targets and contexts

The default `runtime-final` target is the image used by `shorty validate`, `shorty build`, and `shorty serve`. The host launcher builds it locally only when the user runs `shorty image build`. It does not use a registry or a moving `latest` tag.

The `test` target runs the complete Shorty npm test suite. Build it from the full Shorty repository checkout, for example:

```sh
docker build --build-context shorty-git=.git --target test --file docker/runtime/Dockerfile .
```

The test target receives `.git` only as a separate named build context so Git-based commit checks can run without adding Git metadata to the regular build context. It copies `tests/` from the Shorty repository context. Tests are intentionally excluded from the normal npm package installed in a website project, so the test target is not buildable from the installed website package. The regular `runtime-final` target remains buildable from that package without tests or Git metadata.
