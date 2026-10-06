# Money handling standard
- Amounts are integer cents (`number`), never floats. Name them `*Cents`.
- Round only once, at the last step, with `Math.round` (half up).
- Currency is PHP unless a field says otherwise.
