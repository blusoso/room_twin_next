// components/modals/ZoneEditIconPicker.tsx
"use client";
import { ZONE_ICON_CATEGORIES } from "@/lib/data/icons";

interface Props {
  value: string;
  onChange: (icon: string) => void;
}

export default function ZoneEditIconPicker({ value, onChange }: Props) {
  return (
    <div className="zone-edit-icons">
      {ZONE_ICON_CATEGORIES.map((cat) => (
        <div key={cat.label} className="icon-cat">
          <div className="icon-cat-label">{cat.label}</div>
          <div className="icon-cat-grid">
            {cat.icons.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`zone-edit-icon-btn${
                  value === icon ? " active" : ""
                }`}
                onClick={() => onChange(icon)}
                title={icon}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}