Feature: Recent host frames for the dashboard's live panel
  The host agent keeps the last few minutes of telemetry frames in Redis. The panel loads
  them once so its charts are full on arrival, then continues live over the socket.

  Scenario: a storage user may not read host history
    Given I am signed in as "storage@bdd.local"
    When I request the host history
    Then the response status is 403

  Scenario: the superuser gets the frames newest-last
    Given I am signed in as "super@bdd.local"
    And the host agent has published frames at 1000 and 2000
    When I request the host history
    Then the response status is 200
    And the history holds 2 frames ending at 2000
