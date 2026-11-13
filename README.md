# bridgitmckinney.github.io

Author website for Bridgit McKinney: https://bridgitmckinney.github.io

Plain HTML pages (`index.html`, `books.html`, `about.html`, `contact.html`) sharing one stylesheet (`style.css`).

## Updating the site
Every page links its pictures and style.css with a version stamp (?v=...). Whenever a picture or the stylesheet changes, change the stamp on every page so visitors get the new file instead of an old saved copy.

## Book of the Month
Everything about the Book of the Month program lives on `month.html` (its own tab in the menu). To change the featured book each month, edit the featured block and the offer line in the sign-up box on that page.

## Music
`music-player.js` puts a small player in the bottom-left corner of every page. It plays the songs listed at the top of that file in a random order, only after the visitor presses Play, and it remembers when they stop it. To add a song, put the .mp3 in `music/` and add one line to the `SONGS` list, then change the `?v=` stamp on the `music-player.js` line of every page.
