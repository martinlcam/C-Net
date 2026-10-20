Feature: Chunked vault uploads survive retries and parallelism
  Chunks are written by offset, so the same chunk can arrive twice or out of order and
  the finished file is still byte-identical. Finalize trusts the bytes on disk, not a counter.

  Background:
    Given I am a vault user

  Scenario: chunks arriving out of order and twice produce the exact file
    Given an upload session for "clip.bin" of 10 bytes in 4-byte chunks
    When I send chunk 2 with bytes "ij"
    And I send chunk 0 with bytes "abcd"
    And I send chunk 1 with bytes "efgh"
    And I send chunk 1 with bytes "efgh"
    And I finalize the upload
    Then the response status is 201
    And the stored file is exactly "abcdefghij"

  Scenario: concurrent chunks are all recorded
    Given an upload session for "big.bin" of 12 bytes in 4-byte chunks
    When I send chunks 0, 1 and 2 at the same time with bytes "aaaa", "bbbb" and "cccc"
    Then the upload reports 3 received chunks
    When I finalize the upload
    Then the response status is 201
    And the stored file is exactly "aaaabbbbcccc"

  Scenario: a chunk with the wrong length is rejected and not recorded
    Given an upload session for "clip.bin" of 10 bytes in 4-byte chunks
    When I send chunk 0 with bytes "abc"
    Then the response status is 400
    And the upload reports 0 received chunks

  Scenario: the last chunk may only be the remainder
    Given an upload session for "clip.bin" of 10 bytes in 4-byte chunks
    When I send chunk 2 with bytes "ijk"
    Then the response status is 400

  Scenario: a file that is an exact multiple of the chunk size has a full last chunk
    Given an upload session for "even.bin" of 8 bytes in 4-byte chunks
    When I send chunk 0 with bytes "abcd"
    And I send chunk 1 with bytes "efgh"
    And I finalize the upload
    Then the response status is 201
    And the stored file is exactly "abcdefgh"

  Scenario: a chunk index outside the session is rejected
    Given an upload session for "clip.bin" of 10 bytes in 4-byte chunks
    When I send chunk 3 with bytes "zz"
    Then the response status is 400

  Scenario: an empty file finalizes to zero bytes
    Given an upload session for "empty.bin" of 0 bytes in 4-byte chunks
    When I send chunk 0 with bytes ""
    And I finalize the upload
    Then the response status is 201
    And the stored file is exactly ""

  Scenario: finalize refuses when the bytes on disk do not match
    Given an upload session for "clip.bin" of 10 bytes in 4-byte chunks
    When I send chunk 0 with bytes "abcd"
    And I send chunk 1 with bytes "efgh"
    And I send chunk 2 with bytes "ij"
    And the part file on disk is truncated to 6 bytes
    And I finalize the upload
    Then the response status is 409

  Scenario: oversized chunk sizes are refused at session creation
    When I open an upload session for "huge.bin" of 1 bytes with a 128 MiB chunk size
    Then the response status is 400

  Scenario: the source modified time travels from the session to the file
    Given an upload session for "clip.bin" of 4 bytes in 4-byte chunks modified at "2025-01-12T14:02:20.000Z"
    When I send chunk 0 with bytes "abcd"
    And I finalize the upload
    Then the response status is 201
    And the file's source modified time is "2025-01-12T14:02:20.000Z"

  Scenario: open sessions can be found by directory
    Given an upload session for "clip.bin" of 10 bytes in 4-byte chunks
    When I send chunk 0 with bytes "abcd"
    And I list upload sessions in the root
    Then the response status is 200
    And the list has one session for "clip.bin" with received chunks 0

  Scenario: finalizing with a replace target trashes the old file
    Given a vault file "clip.bin" of 4 bytes already exists in the root
    And an upload session for "clip.bin" of 4 bytes in 4-byte chunks
    When I send chunk 0 with bytes "wxyz"
    And I finalize the upload replacing the existing "clip.bin"
    Then the response status is 201
    And the new file is named "clip.bin"
    And the old "clip.bin" is in the trash
    And the stored file is exactly "wxyz"

  Scenario: a replace target that is not the caller's file is refused
    Given an upload session for "clip.bin" of 4 bytes in 4-byte chunks
    When I send chunk 0 with bytes "wxyz"
    And I finalize the upload replacing a file that does not exist
    Then the response status is 400
