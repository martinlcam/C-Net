Feature: Read-only Proxmox overview for the dashboard
  One call returns the node, its guests, its storages, pool health and the UPS state.
  It is host-global, so only the superuser may read it, and it says plainly when the
  Proxmox connection is not configured instead of pretending.

  Scenario: a storage user may not read the host overview
    Given I am signed in as "storage@bdd.local"
    When I request the Proxmox overview
    Then the response status is 403

  Scenario: an anonymous visitor may not read the host overview
    When I request the Proxmox overview
    Then the response status is 401

  Scenario: the superuser gets a clear answer when Proxmox is not configured
    Given I am signed in as "super@bdd.local"
    And the Proxmox connection is not configured
    When I request the Proxmox overview
    Then the response status is 503
    And the error message mentions "CNET_STORAGE_PVE_HOST"
