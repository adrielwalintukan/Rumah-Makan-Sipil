"use client";

import * as React from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface OptionFormData {
  id?: string;
  name: string;
  price_delta: number;
  is_available: boolean;
  sort_order: number;
}

export interface OptionGroupFormData {
  id?: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  sort_order: number;
  options: OptionFormData[];
}

export interface OptionGroupEditorProps {
  groups: OptionGroupFormData[];
  onChange: (groups: OptionGroupFormData[]) => void;
  disabled?: boolean;
  errors?: Record<string, string | undefined>;
}

function getFieldError(
  errors: Record<string, string | undefined> | undefined,
  keys: string[]
): string | undefined {
  if (!errors) return undefined;
  for (const key of keys) {
    if (errors[key]) return errors[key];
  }
  return undefined;
}

export function OptionGroupEditor({
  groups,
  onChange,
  disabled = false,
  errors,
}: OptionGroupEditorProps) {
  const [groupToDelete, setGroupToDelete] = React.useState<number | null>(null);

  const generalError = getFieldError(errors, ["option_groups", "groups"]);

  const handleAddGroup = () => {
    const newGroup: OptionGroupFormData = {
      name: "",
      type: "single",
      required: false,
      sort_order: groups.length,
      options: [
        {
          name: "",
          price_delta: 0,
          is_available: true,
          sort_order: 0,
        },
      ],
    };
    onChange([...groups, newGroup]);
  };

  const handleDeleteGroup = (groupIndex: number) => {
    const group = groups[groupIndex];
    if (!group) return;

    const hasNonEmptyOptions = group.options?.some(
      (opt) => opt.name.trim().length > 0 || opt.price_delta > 0
    );

    if (hasNonEmptyOptions) {
      setGroupToDelete(groupIndex);
    } else {
      handleDeleteGroupDirectly(groupIndex);
    }
  };

  const handleDeleteGroupDirectly = (groupIndex: number) => {
    const newGroups = groups
      .filter((_, idx) => idx !== groupIndex)
      .map((grp, idx) => ({ ...grp, sort_order: idx }));
    onChange(newGroups);
  };

  const handleConfirmDeleteGroup = () => {
    if (groupToDelete !== null) {
      handleDeleteGroupDirectly(groupToDelete);
      setGroupToDelete(null);
    }
  };

  const handleMoveGroup = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= groups.length) return;

    const newGroups = [...groups];
    const temp = newGroups[index];
    newGroups[index] = newGroups[targetIndex];
    newGroups[targetIndex] = temp;

    const reindexed = newGroups.map((grp, idx) => ({
      ...grp,
      sort_order: idx,
    }));
    onChange(reindexed);
  };

  const handleUpdateGroup = (
    groupIndex: number,
    patch: Partial<OptionGroupFormData>
  ) => {
    const newGroups = groups.map((grp, idx) => {
      if (idx === groupIndex) {
        return {
          ...grp,
          ...patch,
        };
      }
      return grp;
    });
    onChange(newGroups);
  };

  const handleAddOption = (groupIndex: number) => {
    const group = groups[groupIndex];
    if (!group) return;

    const newOption: OptionFormData = {
      name: "",
      price_delta: 0,
      is_available: true,
      sort_order: group.options.length,
    };

    const newGroups = groups.map((grp, idx) => {
      if (idx === groupIndex) {
        return {
          ...grp,
          options: [...grp.options, newOption],
        };
      }
      return grp;
    });
    onChange(newGroups);
  };

  const handleDeleteOption = (groupIndex: number, optionIndex: number) => {
    const group = groups[groupIndex];
    if (!group) return;

    const newOptions = group.options
      .filter((_, idx) => idx !== optionIndex)
      .map((opt, idx) => ({ ...opt, sort_order: idx }));

    const newGroups = groups.map((grp, idx) => {
      if (idx === groupIndex) {
        return {
          ...grp,
          options: newOptions,
        };
      }
      return grp;
    });
    onChange(newGroups);
  };

  const handleMoveOption = (
    groupIndex: number,
    optionIndex: number,
    direction: -1 | 1
  ) => {
    const group = groups[groupIndex];
    if (!group) return;

    const targetIndex = optionIndex + direction;
    if (targetIndex < 0 || targetIndex >= group.options.length) return;

    const newOptions = [...group.options];
    const temp = newOptions[optionIndex];
    newOptions[optionIndex] = newOptions[targetIndex];
    newOptions[targetIndex] = temp;

    const reindexedOptions = newOptions.map((opt, idx) => ({
      ...opt,
      sort_order: idx,
    }));

    const newGroups = groups.map((grp, idx) => {
      if (idx === groupIndex) {
        return {
          ...grp,
          options: reindexedOptions,
        };
      }
      return grp;
    });
    onChange(newGroups);
  };

  const handleUpdateOption = (
    groupIndex: number,
    optionIndex: number,
    patch: Partial<OptionFormData>
  ) => {
    const newGroups = groups.map((grp, gIdx) => {
      if (gIdx === groupIndex) {
        const newOptions = grp.options.map((opt, oIdx) => {
          if (oIdx === optionIndex) {
            return {
              ...opt,
              ...patch,
            };
          }
          return opt;
        });
        return {
          ...grp,
          options: newOptions,
        };
      }
      return grp;
    });
    onChange(newGroups);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header Seksi & Tombol Tambah Grup */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-ink-900">
              Grup Pilihan & Opsi (Opsional)
            </h3>
            {groups.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">
                {groups.length} grup
              </span>
            )}
          </div>
          <p className="text-xs text-ink-600 leading-relaxed">
            Tambahkan pilihan kustomisasi untuk menu ini, seperti level pedas, jenis kuah/goreng, atau varian panas/dingin.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleAddGroup}
          disabled={disabled}
          className="min-h-[44px] h-11 shrink-0 font-semibold gap-2 border-line hover:border-green-700 hover:text-green-900"
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          <span>Tambah Grup Pilihan</span>
        </Button>
      </div>

      {/* General Error Alert */}
      {generalError && (
        <div
          role="alert"
          className="rounded-lg bg-danger-bg border border-danger/20 p-3 text-xs text-danger flex items-center gap-2"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Empty State */}
      {groups.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-line bg-cream-50/50 p-6 text-center flex flex-col items-center justify-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-cream-100 text-ink-600">
            <Layers className="size-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <span className="text-sm font-semibold text-ink-900">
              Belum ada grup pilihan
            </span>
            <span className="text-xs text-ink-600 leading-relaxed">
              Menu ini akan disajikan tanpa opsi kustomisasi tambahan. Klik tombol di atas untuk menambah grup baru.
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group, groupIndex) => {
            const groupNameError = getFieldError(errors, [
              `option_groups.${groupIndex}.name`,
              `option_groups[${groupIndex}].name`,
              `group_${groupIndex}_name`,
              `groups.${groupIndex}.name`,
            ]);
            const groupOptionsError = getFieldError(errors, [
              `option_groups.${groupIndex}.options`,
              `option_groups[${groupIndex}].options`,
              `group_${groupIndex}_options`,
              `groups.${groupIndex}.options`,
            ]);

            return (
              <div
                key={group.id || `group-${groupIndex}`}
                className={cn(
                  "rounded-xl border border-line bg-white p-4 sm:p-5 shadow-xs flex flex-col gap-4 transition-all",
                  (groupNameError || groupOptionsError) &&
                    "border-danger/60 ring-2 ring-danger/10"
                )}
              >
                {/* Header Kartu Grup */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-green-900">
                      Grup #{groupIndex + 1}
                    </span>
                    <span className="text-xs text-ink-600">
                      {group.type === "single"
                        ? "Pilih Satu"
                        : "Boleh Lebih dari Satu"}
                      {group.required ? " (Wajib)" : " (Opsional)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Tombol Reorder Grup */}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleMoveGroup(groupIndex, -1)}
                      disabled={disabled || groupIndex === 0}
                      className="size-11 min-h-[44px] min-w-[44px] rounded-lg text-ink-600 hover:text-ink-900 border-line"
                      aria-label={`Pindahkan grup ${group.name || groupIndex + 1} ke atas`}
                      title="Pindahkan grup ke atas"
                    >
                      <ChevronUp className="size-5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleMoveGroup(groupIndex, 1)}
                      disabled={disabled || groupIndex === groups.length - 1}
                      className="size-11 min-h-[44px] min-w-[44px] rounded-lg text-ink-600 hover:text-ink-900 border-line"
                      aria-label={`Pindahkan grup ${group.name || groupIndex + 1} ke bawah`}
                      title="Pindahkan grup ke bawah"
                    >
                      <ChevronDown className="size-5" aria-hidden="true" />
                    </Button>

                    {/* Tombol Hapus Grup */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteGroup(groupIndex)}
                      disabled={disabled}
                      className="size-11 min-h-[44px] min-w-[44px] text-danger hover:bg-danger-bg hover:text-danger rounded-lg"
                      aria-label={`Hapus grup ${group.name || groupIndex + 1}`}
                      title="Hapus grup"
                    >
                      <Trash2 className="size-5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {/* Input Nama Grup */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`group-name-${groupIndex}`}
                    className="text-xs font-semibold text-ink-700"
                  >
                    Nama Grup Pilihan <span className="text-danger">*</span>
                  </label>
                  <Input
                    id={`group-name-${groupIndex}`}
                    type="text"
                    placeholder="Contoh: Varian Suhu, Level Pedas"
                    maxLength={50}
                    value={group.name}
                    onChange={(e) =>
                      handleUpdateGroup(groupIndex, { name: e.target.value })
                    }
                    disabled={disabled}
                    className={cn(
                      "h-11 text-base text-ink-900 bg-white placeholder:text-ink-400 border-line focus-visible:border-green-700",
                      groupNameError && "border-danger ring-2 ring-danger/20"
                    )}
                  />
                  {groupNameError && (
                    <p className="text-xs text-danger font-medium flex items-center gap-1 mt-0.5">
                      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>{groupNameError}</span>
                    </p>
                  )}
                </div>

                {/* Aturan Tipe Pilihan & Wajib Dipilih */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  {/* Tipe: Segmented Radio Pills */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-ink-700">
                      Aturan Pilihan
                    </span>
                    <div
                      role="radiogroup"
                      aria-label="Aturan Pilihan"
                      className="inline-flex rounded-lg border border-line bg-cream-100/70 p-1 gap-1"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={group.type === "single"}
                        disabled={disabled}
                        onClick={() =>
                          handleUpdateGroup(groupIndex, { type: "single" })
                        }
                        className={cn(
                          "flex-1 sm:flex-initial inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-semibold min-h-[44px] transition-all cursor-pointer select-none",
                          group.type === "single"
                            ? "bg-green-700 text-white shadow-xs"
                            : "text-ink-700 hover:text-ink-900 hover:bg-cream-200/50"
                        )}
                      >
                        Pilih Satu (Single)
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={group.type === "multiple"}
                        disabled={disabled}
                        onClick={() =>
                          handleUpdateGroup(groupIndex, { type: "multiple" })
                        }
                        className={cn(
                          "flex-1 sm:flex-initial inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-semibold min-h-[44px] transition-all cursor-pointer select-none",
                          group.type === "multiple"
                            ? "bg-green-700 text-white shadow-xs"
                            : "text-ink-700 hover:text-ink-900 hover:bg-cream-200/50"
                        )}
                      >
                        Boleh Lebih dari Satu (Multiple)
                      </button>
                    </div>
                  </div>

                  {/* Checkbox Wajib Dipilih */}
                  <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer select-none self-start sm:self-end sm:pb-1">
                    <input
                      type="checkbox"
                      checked={group.required}
                      disabled={disabled}
                      onChange={(e) =>
                        handleUpdateGroup(groupIndex, {
                          required: e.target.checked,
                        })
                      }
                      className="size-5 rounded border-line text-green-700 focus:ring-green-700 focus:ring-offset-1 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-ink-900">
                        Wajib dipilih pelanggan
                      </span>
                      <span className="text-xs text-ink-600">
                        {group.type === "single"
                          ? "Pelanggan harus memilih salah satu opsi."
                          : "Pelanggan harus memilih minimal satu opsi."}
                      </span>
                    </div>
                  </label>
                </div>

                {/* Divider */}
                <div className="border-t border-line" />

                {/* Daftar Opsi di dalam Grup */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-700">
                      Daftar Opsi
                    </span>
                    <span className="text-xs text-ink-600 font-medium">
                      {group.options.length} opsi
                    </span>
                  </div>

                  {groupOptionsError && (
                    <p className="text-xs text-danger font-medium flex items-center gap-1">
                      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>{groupOptionsError}</span>
                    </p>
                  )}

                  {group.options.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-line bg-cream-50/60 p-4 text-center text-xs text-ink-600">
                      Belum ada opsi dalam grup ini. Klik &quot;Tambah Opsi&quot; di bawah untuk menambahkan.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {group.options.map((option, optionIndex) => {
                        const optionNameError = getFieldError(errors, [
                          `option_groups.${groupIndex}.options.${optionIndex}.name`,
                          `option_groups[${groupIndex}].options[${optionIndex}].name`,
                          `group_${groupIndex}_option_${optionIndex}_name`,
                        ]);
                        const optionPriceError = getFieldError(errors, [
                          `option_groups.${groupIndex}.options.${optionIndex}.price_delta`,
                          `option_groups[${groupIndex}].options[${optionIndex}].price_delta`,
                        ]);

                        return (
                          <div
                            key={option.id || `option-${optionIndex}`}
                            className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_150px_auto_auto] gap-2 items-center p-2.5 sm:p-0 rounded-lg border border-line bg-cream-50/50 sm:bg-transparent sm:border-0"
                          >
                            {/* 1. Tombol Urutan Opsi */}
                            <div className="flex items-center gap-1 shrink-0 col-start-1 row-start-1 sm:col-start-1 sm:row-start-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  handleMoveOption(groupIndex, optionIndex, -1)
                                }
                                disabled={disabled || optionIndex === 0}
                                className="size-11 min-h-[44px] min-w-[44px] rounded-lg text-ink-600 hover:text-ink-900 border-line"
                                aria-label={`Pindahkan opsi ${option.name || optionIndex + 1} ke atas`}
                                title="Pindahkan ke atas"
                              >
                                <ChevronUp
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  handleMoveOption(groupIndex, optionIndex, 1)
                                }
                                disabled={
                                  disabled ||
                                  optionIndex === group.options.length - 1
                                }
                                className="size-11 min-h-[44px] min-w-[44px] rounded-lg text-ink-600 hover:text-ink-900 border-line"
                                aria-label={`Pindahkan opsi ${option.name || optionIndex + 1} ke bawah`}
                                title="Pindahkan ke bawah"
                              >
                                <ChevronDown
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </Button>
                            </div>

                            {/* 2. Input Nama Opsi */}
                            <div className="col-start-2 row-start-1 sm:col-start-2 sm:row-start-1 min-w-0">
                              <Input
                                type="text"
                                placeholder="Contoh: Panas, Dingin"
                                maxLength={50}
                                value={option.name}
                                onChange={(e) =>
                                  handleUpdateOption(groupIndex, optionIndex, {
                                    name: e.target.value,
                                  })
                                }
                                disabled={disabled}
                                className={cn(
                                  "h-11 text-base text-ink-900 bg-white placeholder:text-ink-400 border-line focus-visible:border-green-700",
                                  optionNameError &&
                                    "border-danger ring-2 ring-danger/20"
                                )}
                                aria-label="Nama opsi"
                              />
                            </div>

                            {/* 3. Tombol Hapus Opsi */}
                            <div className="col-start-3 row-start-1 sm:col-start-5 sm:row-start-1 shrink-0 justify-self-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDeleteOption(groupIndex, optionIndex)
                                }
                                disabled={disabled}
                                className="size-11 min-h-[44px] min-w-[44px] text-danger hover:bg-danger-bg hover:text-danger rounded-lg"
                                aria-label={`Hapus opsi ${option.name || optionIndex + 1}`}
                                title="Hapus opsi"
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </Button>
                            </div>

                            {/* 4. Input Tambahan Harga */}
                            <div className="col-start-1 col-span-2 row-start-2 sm:col-start-3 sm:row-start-1 min-w-0">
                              <div className="relative flex items-center">
                                <span className="absolute left-3 text-xs font-semibold text-ink-600 pointer-events-none select-none">
                                  + Rp
                                </span>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder="0"
                                  maxLength={8}
                                  value={
                                    option.price_delta === 0
                                      ? ""
                                      : option.price_delta.toString()
                                  }
                                  onChange={(e) => {
                                    const cleaned = e.target.value
                                      .replace(/\D/g, "")
                                      .slice(0, 8);
                                    const val =
                                      cleaned === ""
                                        ? 0
                                        : parseInt(cleaned, 10);
                                    handleUpdateOption(
                                      groupIndex,
                                      optionIndex,
                                      { price_delta: val }
                                    );
                                  }}
                                  disabled={disabled}
                                  className={cn(
                                    "h-11 pl-12 pr-3 text-base font-semibold tabular-nums text-ink-900 bg-white placeholder:text-ink-400 border-line focus-visible:border-green-700",
                                    optionPriceError &&
                                      "border-danger ring-2 ring-danger/20"
                                  )}
                                  aria-label="Tambahan harga (Rp)"
                                />
                              </div>
                            </div>

                            {/* 5. Switch Ketersediaan */}
                            <div className="col-start-3 row-start-2 sm:col-start-4 sm:row-start-1 shrink-0 justify-self-end">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={option.is_available}
                                aria-label={`Status ketersediaan opsi ${option.name || optionIndex + 1}`}
                                disabled={disabled}
                                onClick={() =>
                                  handleUpdateOption(groupIndex, optionIndex, {
                                    is_available: !option.is_available,
                                  })
                                }
                                className={cn(
                                  "inline-flex items-center gap-2 rounded-lg border px-3 h-11 min-h-[44px] text-xs font-semibold transition-colors cursor-pointer select-none",
                                  option.is_available
                                    ? "border-green-600/30 bg-green-50 text-green-900 hover:bg-green-100"
                                    : "border-line bg-cream-100 text-ink-600 hover:bg-cream-200/60"
                                )}
                              >
                                <span
                                  className={cn(
                                    "size-2 rounded-full shrink-0",
                                    option.is_available
                                      ? "bg-green-600"
                                      : "bg-ink-400"
                                  )}
                                  aria-hidden="true"
                                />
                                <span>
                                  {option.is_available ? "Tersedia" : "Habis"}
                                </span>
                              </button>
                            </div>

                            {/* Error Opsi Jika Ada */}
                            {(optionNameError || optionPriceError) && (
                              <div className="col-span-3 sm:col-span-5 flex flex-col gap-0.5 text-xs text-danger font-medium pt-0.5">
                                {optionNameError && (
                                  <p className="flex items-center gap-1">
                                    <AlertCircle
                                      className="size-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>{optionNameError}</span>
                                  </p>
                                )}
                                {optionPriceError && (
                                  <p className="flex items-center gap-1">
                                    <AlertCircle
                                      className="size-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>{optionPriceError}</span>
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Tombol Tambah Opsi */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddOption(groupIndex)}
                    disabled={disabled}
                    className="min-h-[44px] h-11 gap-2 font-semibold border-line self-start hover:border-green-700 hover:text-green-900"
                  >
                    <Plus className="size-4 shrink-0" aria-hidden="true" />
                    <span>Tambah Opsi</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog Konfirmasi Hapus Grup */}
      <Dialog
        open={groupToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setGroupToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-danger flex items-center gap-2">
              <Trash2 className="size-5 shrink-0" aria-hidden="true" />
              <span>Hapus Grup Pilihan</span>
            </DialogTitle>
            <DialogDescription className="text-ink-700 pt-2 leading-relaxed">
              {groupToDelete !== null && groups[groupToDelete] ? (
                <>
                  Apakah Anda yakin ingin menghapus grup pilihan{" "}
                  <strong>
                    &quot;
                    {groups[groupToDelete].name ||
                      `Grup #${groupToDelete + 1}`}
                    &quot;
                  </strong>{" "}
                  beserta{" "}
                  <strong>
                    {groups[groupToDelete].options.length} opsi
                  </strong>{" "}
                  di dalamnya? Pilihan yang sudah dihapus tidak dapat
                  dikembalikan.
                </>
              ) : (
                "Apakah Anda yakin ingin menghapus grup pilihan ini?"
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGroupToDelete(null)}
              className="min-h-[44px] h-11 w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeleteGroup}
              className="min-h-[44px] h-11 w-full sm:w-auto"
            >
              Hapus Grup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
