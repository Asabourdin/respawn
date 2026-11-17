#!/bin/zsh
# Generates RESPAWN pixel assets with Codex (imagegen). Usage: zsh assets-src/gen.sh [A B C D]
cd "${0:A:h}"
STYLE=$(cat STYLE.txt)
SCENE_RULE="Each scene: wide 16:9 landscape side-view game background, the top third is mostly open sky (the game tints the sky at runtime), the bottom fifth is calm ground/floor (UI overlays text there), no characters in the foreground centre (small background figures are fine)."
HEAD="Use the imagegen skill to generate SEVEN separate images, one per item, then copy each PNG into ./raw/ with exactly the given filename and print one line per image: FILE -> absolute path. Do not ask questions, just generate."
typeset -A P
P[A]="$HEAD $STYLE $SCENE_RULE
1) bg_campus.png: a modern engineering-and-business campus on the windswept Saclay plateau near Paris at early morning, glass buildings, flat fields, a few wind-bent trees, a commuter train line in the distance, tiny students with backpacks in the background.
2) bg_lecture.png: a big lecture amphitheatre at 8AM, rows of wooden seats seen from the back, a generic professor silhouette (back turned, no face) writing equations on a huge green chalkboard, morning light through tall windows.
3) bg_party.png: a crowded student party in a small Paris flat at night, string lights, a sofa, speakers, silhouettes dancing, a window showing the city at night, warm and lively.
4) bg_library.png: a quiet university library at night, long tables with desk lamps, stacks of books, a laptop glow, rain on tall windows.
5) bg_dorm.png: a tiny student residence room, bed, desk with laptop, posters without text, instant noodles, window with a grey sky.
6) bg_airport.png: an airport departure hall with big windows showing a plane on the tarmac at sunset, suitcases, departure boards as abstract blocks of light.
7) bg_research.png: a desk at 2AM covered with papers and a glowing laptop showing abstract charts, coffee cups, a lamp, a window with stars."
P[B]="$HEAD $STYLE $SCENE_RULE
1) bg_exchange_asia.png: a dense Asian megacity skyline at dusk seen from a rooftop, signs as abstract coloured blocks, humid haze, a river, a university tower.
2) bg_exchange_west.png: a lively western city street for a student exchange semester, brick buildings, a park, a tram, autumn trees.
3) bg_finance.png: a glass skyscraper trading floor at night, rows of monitors with abstract charts, city lights far below, cold blue light, a lonely desk.
4) bg_bigtech.png: a giant tech campus open space, colourful sofas, huge wall screens with abstract shapes, a slide, a drinks fridge, eerily perfect.
5) bg_lab.png: a research lab with racks of GPU servers blinking, whiteboards with abstract diagrams, cables, a coffee machine, a window to a green campus.
6) bg_ngo.png: a community garden and solar panels in a small town, volunteers in the background, crates of vegetables, sunny.
7) bg_garage.png: a startup garage office, whiteboard covered in sticky notes, mismatched chairs, a server under a table, pizza boxes, string lights, night."
P[C]="$HEAD $STYLE $SCENE_RULE
1) bg_home.png: a warm family living room in the evening, sofa, plants, kids toys, a dinner table, soft lamp light, a window with a garden.
2) bg_burnout.png: an empty open-space office at 3AM, one desk still lit, a slumped chair, cold blue screen glow, everything else dark.
3) bg_beach.png: a tropical beach holiday at sunset, palm trees, turquoise water, a plane contrail in the sky, beach towels.
4) bg_retirement.png: a wooden porch of a countryside house with a rocking chair, a vegetable garden, an old dog sleeping, golden afternoon.
5) bg_graveyard.png: a peaceful hillside cemetery at sunset, a single tombstone centre-left, a small lime-green sprout growing next to it, birds, long shadows.
6) bg_stage.png: a conference stage with a spotlight on an empty lectern, a huge abstract screen, an audience in silhouette, camera flashes.
7) bg_pandemic.png: a city street seen from an apartment window during a lockdown, empty street, a laptop video-call glow inside, plants on the windowsill."
P[D]="$HEAD $STYLE
1) earth_good.png: wide 16:9 panorama of a coastal city in the year 2100 in a 1.5 C world: clear blue sky, green parks, trees, trains, wind turbines, healthy sea, lush hills (sky in the top third).
2) earth_mid.png: the SAME coastal city composition in a 2.7 C world: hazy yellow-orange sky, browner hills, the sea noticeably higher reaching the first streets, sea walls, fewer trees.
3) earth_bad.png: the SAME coastal city composition in a 4 C world: dark red-orange sky, wildfire smoke on the hills, the sea flooding the lower city, dead trees, a single lime sprout surviving on a rooftop.
4) sheet_sprouts.png: on a fully transparent background, one horizontal row of 7 plant sprites in the style of the RESPAWN logo sprout (blocky leaves, lime #8FE060), evenly spaced with large gaps: a seed in soil, a tiny sprout, the two-leaf sprout, a young sapling, a small flowering tree, a wilted brown drooping sprout, a burnt charcoal stump.
5) sheet_icons.png: on a fully transparent background, a grid of 20 game UI icons, 5 columns x 4 rows, evenly spaced with large gaps, each bold 16x16-pixel style with a dark #113020 outline: gold coin, heart, two people, star, open hand holding a small globe, padlock, CO2 cloud, airplane, train, smartphone, laptop, briefcase, graduation cap, AI chip, thermometer, ocean wave, bee, sun, trophy, hourglass.
6) sheet_characters.png: on a fully transparent background, one row of 6 character bust portraits (head and shoulders, 48x48-pixel style each, evenly spaced with large gaps), fictional and diverse: a stern but kind middle-aged professor with glasses and chalk dust (generic), a messy friendly roommate with headphones, a charismatic stranger at a party at night, a slick corporate manager with a headset, an energetic former student-club friend in a hoodie, a curious child.
7) sheet_employers.png: on a fully transparent background, a 3x3 grid of 9 fictional company emblems, evenly spaced, NO letters or text, each a simple bold symbol in a square badge: an all-seeing eye in a hexagon, an oil drop with flames, a golden arched bridge, a chess knight, an infinity loop shaped like a phone outline, a swirling wind gust, a leaf in a circle, an atom with a chip, balance scales over a globe."
batches=("$@"); (( ${#batches} )) || batches=(A B C D)
MODEL=${CODEX_MODEL:-gpt-6-astra}
for b in $batches; do
  codex exec --skip-git-repo-check -m "$MODEL" -C "$PWD" "${P[$b]}" < /dev/null > "raw/log-$b.txt" 2>&1 &
done
wait
ls raw/*.png 2>/dev/null | wc -l
