#!/bin/sh
app=${YAP_APP:-"$HOME/Applications/Yap.app"}
export YAP_APP="$app"
exec "$app/Contents/Resources/node/bin/node" "$app/Contents/Resources/cli/main.mjs" "$@"
