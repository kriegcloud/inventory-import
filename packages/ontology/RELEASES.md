# Releases of the inventory-import ontology

One line a version. A change after which data or an answer that held no longer holds is marked breaking, and a
change to a question's expected rows names the question with its old and its new answer.

- 0.1.0: the thin thread
- 0.2.0: the party slice. Breaking: `Member`'s definition and criterion widened (decisions P2 and 154): a pending
  invitee was not a member and now is, a membership is kept after it is revoked, and a membership may let its person
  act in a source's workspace rather than this app's. CQ-P06's rows gain the person's name and the
  sign-in email: the old answer was (tenant, person, member, role) for `test_RaviWorks` as admin of `test_ExampleWorks`
  and `test_RaviSecond` as viewer of `test_SecondOrg`; the new answer is the same two rows as (tenant, person, name,
  member, email, role), each with "Ravi Example" and "test_ravi@example.org". CQ-P07 is new: `test_EmptyOrg` and
  `test_SecondOrg` keep no active admin. `membershipIn`'s definition reworded (decision 169): it now names the tenant the
  membership belongs to and lets its person act in that tenant's workspace or in a source's workspace it names, where
  111's text said only the tenant's. CQ-P06 and CQ-P07 leave out a membership that names a source's workspace (decision 154); their rows
  on their fixtures are unchanged. CQ-P03 is new: `test_Pat` is billing contact at `test_Bakery` and receiving contact
  at `test_Mill`, and `test_Sam` a contact at `test_Bakery` with no purpose.
