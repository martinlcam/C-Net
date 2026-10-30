Feature: Scrub-preview tiles on an item's track listing
  The player's seek bar shows a thumbnail of where you are about to land. Jellyfin
  stores those as trickplay sheets, keyed by media source and tile width; the tracks
  endpoint hands the player one grid description it can address frames in, or nothing
  when the library has not generated tiles for the item yet.

  Scenario: an item with trickplay tiles exposes one grid to the player
    Given a Jellyfin item with trickplay tiles 320 pixels wide, 10 by 10 per sheet, every 10000 milliseconds
    When I build its track listing
    Then the listing has a trickplay grid 320 wide with 10 by 10 tiles every 10 seconds

  Scenario: the widest grid wins when Jellyfin generated several
    Given a Jellyfin item with trickplay tiles at widths 320 and 480
    When I build its track listing
    Then the listing has a trickplay grid 480 wide

  Scenario: an item without tiles says so instead of inventing a grid
    Given a Jellyfin item with no trickplay tiles
    When I build its track listing
    Then the listing has no trickplay grid
