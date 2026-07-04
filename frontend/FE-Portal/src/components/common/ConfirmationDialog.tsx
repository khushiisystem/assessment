import React from "react";
import { AlertTriangle } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmationDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    isLoading?: boolean;
    loadingText?: string;
    showCancelButton?: boolean;
    confirmTone?: "danger" | "primary";
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void | Promise<void>;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    open,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isLoading = false,
    loadingText = "Processing...",
    showCancelButton = true,
    confirmTone = "danger",
    onOpenChange,
    onConfirm,
}) => {
    const isDanger = confirmTone === "danger";

    // Brand-aligned confirm button: solid red for destructive, gradient for primary.
    const confirmButtonClassName = isDanger
        ? "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md"
        : "px-5";

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="w-[min(384px,92vw)] gap-3 sm:max-w-[384px]">
                <div
                    className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ring-8 ${
                        isDanger
                            ? "bg-red-50 text-red-600 ring-red-50/60"
                            : "bg-brand-violet/10 text-brand-violet ring-brand-violet/5"
                    }`}
                >
                    <AlertTriangle className="h-6 w-6" />
                </div>

                <AlertDialogHeader className="space-y-1.5 text-center sm:text-center">
                    <AlertDialogTitle className="text-lg font-bold tracking-tight text-slate-900">
                        {title}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm leading-relaxed text-slate-500">
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter className="mt-2 flex-row justify-center gap-3 sm:justify-center">
                    {showCancelButton && (
                        <AlertDialogCancel className="mt-0 min-w-[96px]" disabled={isLoading}>
                            {cancelText}
                        </AlertDialogCancel>
                    )}
                    <AlertDialogAction
                        className={`min-w-[96px] ${confirmButtonClassName}`}
                        disabled={isLoading}
                        onClick={async (event) => {
                            event.preventDefault();
                            if (isLoading) return;
                            await onConfirm();
                        }}
                    >
                        {isLoading ? loadingText : confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
