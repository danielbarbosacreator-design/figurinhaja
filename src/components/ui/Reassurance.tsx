/** Microcopy de confiança — badges horizontais com check verde. */
export function Reassurance({ items }: { items: string[] }) {
  return (
    <ul
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px 16px",
        justifyContent: "center",
        listStyle: "none",
        margin: 0,
        padding: 0,
      }}
    >
      {items.map((it) => (
        <li
          key={it}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "13px",
            color: "#64748B",
            fontWeight: 600,
          }}
        >
          <span
            aria-hidden
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "#16A34A",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ✓
          </span>
          {it}
        </li>
      ))}
    </ul>
  );
}
