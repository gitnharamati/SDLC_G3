Bug 08 – Duplicate names
1.	Products are defined by their placement – Department, Category and Room (DCR), not by their name, and the test if that product exists should focus on that definition.
2.	Adding a product is disrupted iff a product with the same DCR definition is found.
3.	Best practice would be to send a message to the inventory manager to ensure the new product is not simply an error if no new inventory exists. If there is new inventory, a simple way to insert the new product as modification of the existing one needs to be provided (an SQL ‘insert or update’ with the necessary information statement should suffice). Either way, a record of the disruption need be.
4.	Duplicate names (but distinct DCR definition) should generate a warning and allow the data input person to either change the name or ignore the warning. Either way, a record of the disruption need be logged.
5.	Name search results should always include a textual or visual representation of the DCR definition.
