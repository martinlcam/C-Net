Feature: Saving a movie or episode for offline viewing
  The media page offers a download button so something can be watched without a
  connection. The saved file should be named so a folder of them sorts and reads
  sensibly on any laptop, and the link that serves it must only work as a download
  for the person it was signed for.

  Scenario: an episode is named after its show, number and title
    Given a Jellyfin episode "Forever" of "VisionQuest", season 1 episode 8, stored as "VisionQuest - S01E08 - Forever WEBDL-1080p.mkv"
    When I name its download
    Then the download is named "VisionQuest - S01E08 - Forever.mkv"

  Scenario: a movie is named after its title and year
    Given a Jellyfin movie "Eternals" from 2021, stored as "Eternals (2021) WEBRip-1080p.mp4"
    When I name its download
    Then the download is named "Eternals (2021).mp4"

  Scenario: characters Windows refuses in a filename are dropped
    Given a Jellyfin episode "What If… Zombies?!" of "What If…?", season 1 episode 5, stored as "ep.mkv"
    When I name its download
    Then the download is named "What If… - S01E05 - What If… Zombies!.mkv"

  Scenario: the container decides the extension when the path is unknown
    Given a Jellyfin movie "Avatar: Fire and Ash" from 2025 in a "mov,mp4,m4a" container with no path
    When I name its download
    Then the download is named "Avatar Fire and Ash (2025).mov"

  Scenario: a download link is signed as a download, not as a stream
    Given a Jellyfin movie "Eternals" from 2021, stored as "Eternals (2021) WEBRip-1080p.mp4"
    When I sign its download link for user "bdd-user"
    Then the link carries the filename "Eternals (2021).mp4"
    And the link verifies as an attachment for user "bdd-user"
    But the link does not verify as an inline stream for user "bdd-user"
    And the link does not verify as an attachment for user "someone-else"
