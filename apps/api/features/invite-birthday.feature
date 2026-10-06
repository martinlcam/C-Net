Feature: The birthday deterrent
  The birthday is not checked against anything, but it must be a plausible date.

  Background:
    Given an event with guests "Ana"

  Scenario Outline: an implausible birthday is refused
    When "Ana" answers "yes" with birthday "<birthday>"
    Then the response status is 400
    And "Ana" has not answered

    Examples:
      | birthday   | reason          |
      | 31/10/1999 | not YYYY-MM-DD  |
      | 2026-02-30 | not a real date |
      | 1899-12-31 | before 1900     |
      | tomorrow   | in the future   |

  Scenario: today is still a plausible birthday
    When "Ana" answers "yes" with birthday "today"
    Then the response status is 200
