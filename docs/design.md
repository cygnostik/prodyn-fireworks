# Design provenance

AFTERLIGHT is a widescreen fireworks instrument. The sky is the primary surface; compact effect families and the Finale composer sit below it. Cinema mode removes the instrument while preserving touch firing and a visible way back. The opening copy fades after four seconds, including in reduced-motion mode; reduced motion starts the sky still.

The interface draws on ProDyn Threadline DSM 2.2: near-black field, ivory typography, restrained cyan, square controls, hairline separation, Oxanium display/body text and Departure Mono labels. [`src/theme.css`](../src/theme.css) maps those design roles into the app. The scene uses its own warm metallic and coloured emissions rather than colouring the fireworks as interface signals.

The application’s wordmark, effect pictograms, scene, particles and social artwork are original and covered by the [MIT licence](../LICENSE). Utility icons come from Phosphor under MIT. Oxanium and Departure Mono retain their SIL OFL 1.1 terms and [licence notices](../public/licenses/). The DSM is a design reference, not a bundled asset library; its manual, brand logos and PP Neue Machina are not redistributed.

Each effect pictogram depicts its geometry or motion: a ring, nested spheres, falling trails, a split cross, a fixed wheel or a low fan. Names remain available beside the symbols and in accessible button labels. The six family selectors reduce the visible effect pad without making the whole library a large menu.

The Finale is an ordered set of up to twelve layers. A layer retains its effect, palette and density. The show scheduler spreads those layers across the sky, increases activity through the build and aligns their final launches. Show files and share links contain validated data, not executable instructions.

Sound requires an explicit gesture. Hidden pages suspend visual time and mute sound; returning does not automatically restore sound. All important actions have DOM controls; the canvas is an additional direct-manipulation surface. Gentle mode reduces flashes but is not a guarantee of photosensitive safety.
