# Kits: Bygga guides for your own product

A kit is one JSON file that describes a product you make: its parts as boxes in the finished product, and the steps that put them together. Bygga turns it into the same guide it draws for IKEA products, so your customers get a 3D, step by step assembly guide without you making a single drawing.

## Who it is for

- Hardware startups that ship something to put together: printer enclosures, standing desks, e-bike racks, smart home kits, robot arms
- Direct to consumer furniture brands that want a better guide than a PDF
- Makers who sell plans or kits and want buyers to finish the build

## What you get

- Animated 3D steps: each part flies in from the way it goes on, with every screw, bolt, dowel and hinge drawn where it goes, worked out from where your parts touch
- A parts and tools check before the first step, with counts per step
- The hands-free voice: people say "next", "back", "again" or "what do I need" with their hands full
- Offline: once a guide is open, it keeps working with no signal (a garage, a new flat)
- A print view (A4) from the same steps
- A share link that carries the whole guide in its address, so there is no server copy and nothing to host
- An embed snippet (an iframe) for your product page or help centre

## Writing a kit

The smallest kit has a name, two parts and a step:

```json
{
  "kit": 1,
  "name": "LOOP",
  "parts": [
    { "id": "S", "name": "Side", "size": [18, 600, 400], "pos": [-300, 300, 0] },
    { "id": "T", "name": "Top", "size": [600, 18, 400], "pos": [0, 609, 0] }
  ],
  "steps": [{ "title": "Screw the top onto the side", "add": ["S", "T"], "fix": [{ "kind": "screw", "count": 2, "len": 30 }] }]
}
```

Three full examples live in [`public/kits/`](../public/kits/): an acrylic printer enclosure, an electric standing desk frame and a wooden planter.

### Coordinate system

All sizes and positions are millimetres, and every part is placed where it sits in the finished product.

- `x` runs left to right, `y` up from the floor, `z` from the back (minus) to the front (plus)
- `pos` is the centre of the part's box, so a 18 mm thick bottom panel on the floor has `y` 9
- `size` is `[width, height, depth]` along x, y and z

Bygga moves the whole product so it stands on the floor, centred, so you can pick any origin you like.

### Top level fields

| Field | Type | Notes |
| --- | --- | --- |
| `kit` | `1` | The format version. Required. |
| `name` | text | Product name, up to 40 characters. Shown in capitals. Required. |
| `brand` | text | Your brand, up to 40 characters. |
| `variant` | text | Size or model, such as "Electric standing desk, 140x70 cm". |
| `category` | text | What it is, such as "Standing desk". |
| `minutes` | number | Typical build time. Worked out from the step count when left out. |
| `people` | 1 or 2 | People needed. Becomes 2 when any step needs two. |
| `difficulty` | 1, 2 or 3 | Easy, medium or hard. |
| `support` | https link | Your help page, shown in the guide. |
| `parts` | list | The parts, below. Required, at least two. |
| `steps` | list | The steps, below. Required. |
| `tips` | object | Short tips, up to 220 characters each, under `general`, `frame`, `back`, `shelves`, `drawers`, `doors`, `legs`, `slats`, `cushions` or `anchor`. |
| `watchOut` | list of text | One or two things to be careful about. |

### Parts

| Field | Type | Notes |
| --- | --- | --- |
| `id` | text | Your id for the part, used by steps. Required, unique. |
| `label` | text | The number or letter printed on the part, up to 3 characters. |
| `name` | text | What it is called, up to 40 characters. Required. |
| `size` | `[w, h, d]` | Millimetres. Required. For a cylinder: `[diameter, length, diameter]`. |
| `pos` | `[x, y, z]` | Centre in the finished product, millimetres. Required. |
| `shape` | `box` or `cyl` | Defaults to `box`. |
| `material` | `board`, `fiber`, `wood`, `metal` or `soft` | How it is drawn. `fiber` suits thin sheets such as acrylic or hardboard. |

### Steps

| Field | Type | Notes |
| --- | --- | --- |
| `title` | text | What to do, up to 80 characters. Read out loud. Required. |
| `detail` | text | One or two more sentences, up to 240 characters. |
| `add` | list of part ids | The parts that join the build in this step. |
| `fix` | list | Fittings used in this step, below. |
| `tools` | list | `allen`, `screwdriver`, `flathead`, `hammer`, `drill`, `wrench`, `level`, `tape`, `pencil`, `knife`. |
| `people` | 1 or 2 | When this step needs a second person. |
| `pose` | `+y`, `-y`, `+z`, `-z`, `+x`, `-x` | How the build lies: `+y` upright, `-y` upside down, `+z` on its back, `-z` face down, `+x` and `-x` on a side. |
| `warnings` | list | `two` (two people), `wall` (fix to the wall), `tip` (tip over risk), `floor` (protect the floor), `loose` (don't tighten yet), `hand` (hand tight only), `square` (check it is square), `face` (mind which side faces out). |

### Fittings (`fix`)

| Field | Type | Notes |
| --- | --- | --- |
| `kind` | text | `dowel`, `camScrew`, `cam`, `screw`, `nail`, `pin`, `legScrew`, `bolt`, `plate`, `bracket`, `knob`, `handle`, `hinge` or `glide`. Other words ("hex bolt", "felt pad") are read as the nearest of these, with a warning. |
| `count` | number | How many in this step. |
| `len`, `dia` | number | Millimetres. |
| `to` | list of part ids | The parts they go into, when it matters. |

Bygga places each fitting itself, on the faces where the parts in the step touch.

## Tips for positions

- Parts that join must touch: a side panel's inner face at the same x as the end of a shelf. Bygga closes gaps and overlaps under 25 mm, but bigger ones read as floating parts.
- Don't let parts sit inside each other. Panels that run in a frame's slot can share the slot's centre line, but keep them out of the frame's box.
- Build up from the floor and write each `y` as the part below's top plus half the part's own height.
- Order `add` the way the build goes: the first parts stay put and later parts snap to them.
- Every part is a square box or an upright cylinder: kits don't take turned parts yet.
- Keep to 80 parts and 40 steps, and up to 48 of one fitting in a step. Repeated identical parts (four legs) are four entries with the same `label`.

## Check a kit

```sh
npm run kit:check -- public/kits/*.json
```

For each file it lists problems (the guide can't be built, or a field was dropped) and warnings (something was changed or guessed), the part and step counts, and the share link. Fix every problem before you share a kit; most warnings mean a value was cleaned up.

## The /kit page

Open `/kit` to write or paste a kit, or drop a `.json` file onto it. It checks the kit as you type, shows the finished product in 3D next to the list of problems, and then gives you:

- **Open guide**: the full guide, the same as any other on Bygga
- **Copy link**: the share link, with the whole kit packed into the address after `#g=`
- **Copy embed**: an iframe for your own site

The example kits are on the page too, as a starting point. Nothing you type leaves your browser.
