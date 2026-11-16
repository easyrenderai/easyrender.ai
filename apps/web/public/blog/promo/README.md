# Article promo media

`room-reveal.mp4` is an 8.17-second, silent, 600 × 400 (3:2) excerpt of the owner's
existing `Downloads/easyrender-ar-tienda.mp4` marketing video. It shows an empty room,
the chair reveal, camera movement and the chair being turned. This is a staged
promotional visualization, not a recording of the live product UI or generation time.

The 1080 × 1920 source is trimmed from 0.5 to 8.65 seconds, cropped to
1080 × 720 at (0, 560), scaled to 600 × 400, and encoded as H.264, 24 fps,
yuv420p, CRF 25, with faststart and no audio. The crop removes every baked-in
shopping headline, platform claim and AR interface control. Generic, localized
copy lives outside the video in `Blog.post.promo` in all six message files.
The clip does not advertise an in-app AR action.

`room-reveal.jpg` is the 3.7-second still, used for reduced motion, loading and
playback failure. The card keeps its free-preview / paid-model disclosure.

Rebuild the MP4 with:

```sh
ffmpeg -ss 0.5 -t 8.15 -i easyrender-ar-tienda.mp4 \
  -vf 'crop=1080:720:0:560,scale=600:400,fps=24' \
  -an -c:v libx264 -crf 25 -preset slow -pix_fmt yuv420p \
  -movflags +faststart room-reveal.mp4
ffmpeg -ss 3.7 -i room-reveal.mp4 -frames:v 1 -q:v 3 room-reveal.jpg
```
