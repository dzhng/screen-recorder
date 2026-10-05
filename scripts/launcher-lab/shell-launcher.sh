#!/bin/sh
app=${SCREENREC_APP:-"$HOME/Applications/Screen Recorder.app"}
export SCREENREC_APP="$app"
exec "$app/Contents/Resources/node/bin/node" "$app/Contents/Resources/cli/main.mjs" "$@"
