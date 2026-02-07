#!/bin/bash
# Create simple placeholder icons using ImageMagick
convert -size 16x16 xc:#4CAF50 -pointsize 10 -fill white -gravity center -annotate +0+0 "CE" icon16.png
convert -size 48x48 xc:#4CAF50 -pointsize 28 -fill white -gravity center -annotate +0+0 "CE" icon48.png
convert -size 128x128 xc:#4CAF50 -pointsize 72 -fill white -gravity center -annotate +0+0 "CE" icon128.png
