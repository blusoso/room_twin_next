// components/modals/ZoneEditColorPicker.tsx
"use client";
import { ZONE_COLOR_CHOICES } from "@/lib/data/constants";
import { hexOf } from "@/lib/utils/format";

interface Props {
  value: number;
  onChange: (color: number) => void;
}

export default function ZoneEditColorPicker({ value, onChange }: Props) {
  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value.slice(1), 16));
  };

  return (
    <>
      <div className="zone-edit-colors">
        {ZONE_COLOR_CHOICES.map((col) => (
          <button
            key={col}
            type="button"
            className={`zone-edit-color-btn${
              value === col ? " active" : ""
            }`}
            style={{ background: hexOf(col) }}
            onClick={() => onChange(col)}
            aria-label={hexOf(col)}
          />
        ))}
      </div>

      <div className="zone-edit-color-custom">
        <label className="zone-edit-custom-label">หรือเลือกสีเอง</label>
        <input
          type="color"
          value={hexOf(value)}
          onChange={handleCustomChange}
        />
        <span className="zone-edit-color-hex">{hexOf(value)}</span>
      </div>
    </>
  );
}