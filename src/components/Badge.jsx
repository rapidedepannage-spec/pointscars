import React from 'react';
import { STATUTS } from '../config/constants';

function Badge({ s }) {
  const x = STATUTS.find(z => z.id === s) || STATUTS[0];
  return (
    <span
      style={{
        padding: "3px 9px",
        borderRadius: 12,
        fontSize: 9,
        fontWeight: 700,
        color: x.c,
        background: x.c + "15",
        border: "1.5px solid " + x.c + "50",
        whiteSpace: "nowrap"
      }}
    >
      {x.l}
    </span>
  );
}

export default Badge;
