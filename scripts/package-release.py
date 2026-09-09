"""Package the reviewed public source and finished site with an explicit allowlist."""
from pathlib import Path
import argparse
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = [
    'README.md', 'LICENSE', '.gitignore', 'package.json', 'package-lock.json',
    'index.html', 'vite.config.js', 'playwright.config.js',
]
DOC_FILES = [
    'docs/audio.md', 'docs/renderer.md', 'docs/design.md', 'docs/deployment.md',
    'docs/pwa.md', 'docs/research/fireworks.md', 'docs/research/field-guide-data.json',
]
TREES = {
    'src': {'.js', '.mjs', '.css'},
    'scripts': {'.js', '.mjs', '.py'},
    'tests': {'.js', '.mjs'},
    'public': {'.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.txt', '.svg', '.png', '.jpg', '.woff2', '.wav'},
}
SITE_EXTENSIONS = TREES['public']


def files_in(directory, extensions):
    result = []
    for path in sorted(directory.rglob('*')):
        if '__pycache__' in path.relative_to(directory).parts:
            continue
        if path.is_symlink():
            raise ValueError(f'Symlink not allowed in public package: {path.relative_to(ROOT)}')
        if not path.is_file() or path.name == '.DS_Store':
            continue
        if any(part.startswith('.') for part in path.relative_to(directory).parts):
            if path.name != '.htaccess' or path.parent != directory:
                raise ValueError(f'Unexpected hidden public file: {path.relative_to(ROOT)}')
        if path.suffix not in extensions and path.name != '.htaccess':
            raise ValueError(f'Unexpected public file type: {path.relative_to(ROOT)}')
        result.append(path)
    return result


def source_files():
    result = [ROOT / name for name in ROOT_FILES + DOC_FILES]
    for directory, extensions in TREES.items():
        result.extend(files_in(ROOT / directory, extensions))
    for path in result:
        if not path.is_file() or path.is_symlink():
            raise ValueError(f'Missing or non-regular source file: {path.relative_to(ROOT)}')
    if len(result) != len(set(result)):
        raise ValueError('Duplicate source package path')
    return sorted(result)


def package(staging, output):
    staging, output = staging.resolve(), output.resolve()
    if staging.exists() or output.exists():
        raise FileExistsError('Refusing to replace an existing staging directory or archive')
    version = json.loads((ROOT / 'package.json').read_text())['version']
    source = source_files()
    dist = ROOT / 'dist'
    site = files_in(dist, SITE_EXTENSIONS)
    inventory = json.loads((dist / 'pwa-inventory.json').read_text())
    if inventory['version'] != version:
        raise ValueError('Build and source versions differ')
    for item in inventory['entries']:
        from urllib.parse import unquote
        path = dist / unquote(item['url'])
        if not path.is_file() or path.stat().st_size != item['bytes']:
            raise ValueError(f'Stale PWA inventory entry: {item["url"]}')
    for required in ['index.html', 'sw.js', 'manifest.webmanifest', 'credits.html', 'field-guide.html', 'sound-library.html']:
        if dist / required not in site:
            raise ValueError(f'Missing site file: {required}')
    staging.mkdir(parents=True)
    copied = []
    for prefix, base, selected in [('source', ROOT, source), ('site', dist, site)]:
        for path in selected:
            target = staging / prefix / path.relative_to(base)
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as stream:
                stream.write(path.read_bytes())
            shutil.copystat(path, target)
            copied.append(target)
    introduction = f'''# AFTERLIGHT {version}

A 3D fireworks instrument with 40 effects, a layered Finale composer and offline installation.

- **site/** — finished website. Upload its contents to your web root.
- **source/** — editable application, tests, build tools, original sound-generation source and research guide.
- **LICENSE** — application MIT licence. Font and dependency notices are also included under `site/licenses/` and `source/public/licenses/`.

## Open locally

From this directory, run:

```sh
python3 -m http.server --bind 127.0.0.1 --directory site 8080
```

Open http://127.0.0.1:8080/. Use a local server rather than opening `index.html` directly.

## Build and customize

See [source/README.md](source/README.md) and [deployment instructions](source/docs/deployment.md).

Live site: https://fireworks.prodyn.ai/  
Source repository: https://github.com/cygnostik/prodyn-fireworks
'''
    for name, content in [('START-HERE.md', introduction), ('LICENSE', (ROOT / 'LICENSE').read_text())]:
        path = staging / name
        with path.open('x') as stream:
            stream.write(content)
        copied.append(path)
    manifest = {
        'version': version,
        'files': [{'path': p.relative_to(staging).as_posix(), 'bytes': p.stat().st_size} for p in sorted(copied)],
    }
    manifest_path = staging / 'contents.json'
    with manifest_path.open('x') as stream:
        stream.write(json.dumps(manifest, indent=2) + '\n')
    copied.append(manifest_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('xb') as stream:
        with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path in sorted(copied):
                archive.write(path, 'prodyn-fireworks/' + path.relative_to(staging).as_posix())
    expected = {'prodyn-fireworks/' + p.relative_to(staging).as_posix(): p for p in copied}
    with zipfile.ZipFile(output) as archive:
        if set(archive.namelist()) != set(expected) or len(archive.namelist()) != len(expected):
            raise ValueError('Archive members do not match the public file allowlist')
        for name, path in expected.items():
            if archive.read(name) != path.read_bytes():
                raise ValueError(f'Archive read-back differs: {name}')
    result = {'archive': str(output), 'staging': str(staging), 'version': version, 'source_files': len(source), 'site_files': len(site), 'archive_files': len(copied), 'archive_bytes': output.stat().st_size, 'read_back': 'all members match their staged bytes'}
    print(json.dumps(result, indent=2))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--staging', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    package(args.staging, args.output)
