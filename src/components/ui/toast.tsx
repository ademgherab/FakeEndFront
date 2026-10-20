/**
 * Toast entry point.
 *
 * shadcn/ui now ships toasts through Sonner for Radix-based projects, so this
 * module is the stable import surface for the rest of the app:
 *
 *   import { toast } from "@/components/ui/toast";
 */
export { Toaster } from "@/components/ui/sonner";
export { toast } from "sonner";
