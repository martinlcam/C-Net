Feature: A guest answers
  A guest answers once. Saying yes reveals the group chat link; saying no does not.
  Either way the name leaves the invite list.

  Background:
    Given an event with guests "Ana", "Ben" and "Cy"

  Scenario: answering yes
    When "Ana" answers "yes" with birthday "1999-10-31"
    Then the response status is 200
    And the response contains the group chat link
    And "Ana" is stored as "yes" with birthday "1999-10-31"
    When I open the invite
    Then I do not see the name "Ana"

  Scenario: answering no
    When "Ben" answers "no" with birthday "2001-01-15"
    Then the response status is 200
    And the response does not contain the group chat link
    And "Ben" is stored as "no" with birthday "2001-01-15"
    When I open the invite
    Then I do not see the name "Ben"

  Scenario: answering twice is refused
    Given "Cy" has already answered "no" with birthday "1995-07-07"
    When "Cy" answers "yes" with birthday "1990-01-01"
    Then the response status is 409
    And "Cy" is stored as "no" with birthday "1995-07-07"

  Scenario: answering through another event's link is refused
    Given a second event with guests "Dee"
    When "Dee" answers "yes" with birthday "1999-10-31" through the first event's link
    Then the response status is 404
    And "Dee" has not answered

  Scenario: answering as a guest who does not exist
    When guest "2b4bd45e-5a60-4f6e-9d2d-0a4a1b1d9f11" answers "yes" with birthday "1999-10-31"
    Then the response status is 404

  Scenario: sending a non-boolean answer
    When "Ana" sends attending "maybe" with birthday "1999-10-31"
    Then the response status is 422
    And "Ana" has not answered
