Feature: Martin reviews responses
  Only the superuser can see who answered what, and their birthdays.

  Background:
    Given an event with guests "Ana", "Ben" and "Cy"
    And "Ana" has already answered "yes" with birthday "1999-10-31"
    And "Ben" has already answered "no" with birthday "2001-01-15"

  Scenario: without a session
    When I request the responses overview
    Then the response status is 401

  Scenario: as a storage-role user
    Given I am signed in as "storage@bdd.local"
    When I request the responses overview
    Then the response status is 403

  Scenario: as the superuser
    Given I am signed in as "super@bdd.local"
    When I request the responses overview
    Then the response status is 200
    And the overview lists my event with:
      | name | rsvp | birthday   |
      | Ana  | yes  | 1999-10-31 |
      | Ben  | no   | 2001-01-15 |
      | Cy   |      |            |
