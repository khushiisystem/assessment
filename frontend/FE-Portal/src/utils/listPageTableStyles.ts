/** Shared react-data-table-component styles aligned with Candidate Management tables */
export const listPageTableStyles = {
  headRow: {
    style: {
      backgroundColor: "#fafafa",
      borderBottomWidth: "1px",
      borderBottomColor: "#e5e7eb",
      borderBottomStyle: "solid" as const,
      color: "#374151",
      fontSize: "12px",
      fontWeight: 600,
      letterSpacing: "0.01em",
    },
  },
  headCells: {
    style: {
      paddingLeft: "12px",
      paddingRight: "12px",
      paddingTop: "8px",
      paddingBottom: "8px",
    },
  },
  cells: {
    style: {
      paddingLeft: "12px",
      paddingRight: "12px",
      paddingTop: "10px",
      paddingBottom: "10px",
      fontSize: "13px",
      color: "#111827",
    },
  },
  rows: {
    style: {
      borderBottomWidth: "1px",
      borderBottomColor: "#eef2f6",
      borderBottomStyle: "solid" as const,
      backgroundColor: "#ffffff",
      "&:hover": { backgroundColor: "#faf7ff" },
    },
  },
};
