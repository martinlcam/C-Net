Feature: A guest opens the invite
  The invite is reached only by its random link. It shows the party post and the
  names that have not answered yet, and never reveals the group chat link.

  Scenario: the invite lists everyone who has not answered
    Given an event with guests "Ana", "Ben" and "Cy"
    When I open the invite
    Then the response status is 200
    And I see the title "Dressed for the Wrong Occasion"
    And I see the details, time and location
    And I see the names "Ana", "Ben" and "Cy"
    And I do not see the group chat link

  Scenario: a guest who has answered is no longer listed
    Given an event with guests "Ana", "Ben" and "Cy"
    And "Ben" has already answered "yes" with birthday "1998-05-04"
    When I open the invite
    Then I see the names "Ana" and "Cy"
    And I do not see the name "Ben"

  Scenario: an unknown invite is not found
    When I open the invite "2b4bd45e-5a60-4f6e-9d2d-0a4a1b1d9f11"
    Then the response status is 404

  Scenario: a malformed invite id is not found
    When I open the invite "not-a-uuid"
    Then the response status is 404
