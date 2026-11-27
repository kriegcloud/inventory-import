# Releases of the inventory-import ontology

One line a version. A change after which data or an answer that held no longer holds is marked breaking, and a
change to a question's expected rows names the question with its old and its new answer.

- 0.1.0: the thin thread
- 0.2.0: the party slice. Breaking: `Member`'s definition and criterion widened (decisions P2 and 154): a pending
  invitee was not a member and now is, a membership is kept after it is revoked, and a membership may let its person
  act in a source's workspace rather than this app's. `membershipIn`'s definition reworded (decision 169): it now names
  the tenant the membership belongs to and lets its person act in that tenant's workspace or in a source's workspace it
  names, where 111's text said only the tenant's. CQ-P06's answer changed: the old answer was (tenant, person, member,
  role) for `test_RaviWorks` as admin of `test_ExampleWorks` and `test_RaviSecond` as viewer of `test_SecondOrg`; the
  new answer is the same two rows as (tenant, person, name, member, email, role), each with "Ravi Example" and
  "test_ravi@example.org". The name and the email are each optional: a member whose person states no name is listed
  with no name (decision 177), and a member with no sign-in account with no email (decision 134). CQ-P06 leaves out a
  membership that names a source's workspace (decision 154); its rows on its fixture are unchanged. New questions, each
  with its answer on its fixture: CQ-P01, `test_CoPacker` for `test_ExampleWorks` and `test_OtherCoPacker` for
  `test_SecondOrg` are bought from and sold to; CQ-P02, `test_DormantCo` and `test_OpenCo` hold no trading role;
  CQ-P09's party half, `test_HeldNowhere` held by no tenant and `test_HeldTwice` by two; CQ-P04, `test_AcmeA` and
  `test_AcmeB` decided one party by `test_Dana` at 09:00 on "same tax id", and no pair for `test_AcmeC` and
  `test_AcmeD`, which share only a name (decision 179); CQ-P05, false; CQ-P07, `test_EmptyOrg` and `test_SecondOrg`
  keep no active admin, a membership that names a source's workspace left out (decision 154); CQ-P03, `test_Pat` is
  billing contact at `test_Bakery` and receiving contact at `test_Mill`, and `test_Sam` a contact at `test_Bakery` with
  no purpose.
