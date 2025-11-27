# Racetrack

See https://en.wikipedia.org/wiki/Racetrack_(game)

# Query 1

I want you to play a multiplayer version of the pen and paper game racetrack. It should be one index.html file, one script.js file and one style.css file.
I want this to be a multiplayer game with two stages: Stage 1 allows someone to draw a curve and then that curve is widened to form the race track with the start and end point chosen randomly. Stage 2 is the actual game. We add an arbitrary number of players with their names and they take turn. The race car can move according to the standard rules. I want this to behave like how in chess when I click on a pawn I get to see the fields I can move to. Draw a vector from the current position to the center square and highlight the surrounding squares in the players color. If a player leaves the track they are being moved two moves. Winner is who finishes the track first.
This should be playable by kids so keep a simple style present.
Also provide an option to print the track (with or without grid lines).

# Query 2

Okay, not such a childish style. Just simplify it so it looks modern. also make the track creation larger and simplify everything a bit, buttons at the top, etc. there is an issue so as is visible by this image: after creating the track, clear any edges that are inside the course. See the picture.

# Query 3

Very solid. Minor improvements: Draw a line for the start. and on the edge of the track at the start, hint the direction at which we are going which is chosen randomly. the finish is also the start line after making a full turn. The grid has to overlap with the track, right now the track is blanking the grid but it is needed. then when making a turn, highlight the full cell. make the squares slightly larger. actually make that an option. and then make everything slightly higher resolution. and a big bigger everything. also highlight the current player in it's own color. And when you crash, you should move back two turns. Also make it such that the track is zoomable like e.g. in excalidraw where i can zoom in and out arbitraily. add an option to center the view.

# Query 4

I am not a fan of the icons in the title bar. make it look cleaner with just text buttons. See if there are any stylistic improvements to make this look really modern and clean and like a great web game. Move the zoom, pan, center button to the bottom right in an overlayed menu that can be minimized. Move the grid settings to a hamburger menu at the top right. Check if it makes sense to refactor anything? Is this solid code? simplify if needed in terms of functionality. Also make sure the start/finish line covers the full width of the track.

# Query 5

The move logic is broken, i cant select a field to move to, i'm stuck. this worked previously.Change the center icon to something simpler, I don't like the dart. Also, it is not properly centering, assure that every part of the track is visible with some buffer, like bounding box is [minx miny] to [maxx maxy]. Also, the start line is not drawn perfectly over the full width of the track. Also when drawing, add an option to widen or shrinken the track, effectively make it easier or harder

# Query 6

The grid of cells you can select should overlap perfectly with the grid drawn in the background it should feel like you can click any of the cells so outline all nine of them
