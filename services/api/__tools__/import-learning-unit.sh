#!/bin/bash
# npm run import:learning-unit -- \
#   --audio-url https://downloads.bbc.co.uk/learningenglish/features/are/bbc_are_think_on_your_feet.mp3 \
#   --pdf-url https://downloads.bbc.co.uk/learningenglish/features/are/bbc_are_think_on_your_feet.pdf


npm run import:learning-unit -- \
  --audio-url https://downloads.bbc.co.uk/learningenglish/features/are/bbc_are_cant_see_the_wood_for_the_trees.mp3 \
  --pdf-url https://downloads.bbc.co.uk/learningenglish/features/are/bbc_are_cant_see_the_wood_for_the_trees.pdf


curl -X POST http://127.0.0.1:3000/admin/content-units/176376227093811200/auto-sync
curl -X POST http://127.0.0.1:3000/admin/content-units/176376227093811200/publish