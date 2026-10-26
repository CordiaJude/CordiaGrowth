"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const isSignup = mode === "signup";
  const [state, action] = useActionState<AuthState, FormData>(isSignup ? signUp : signIn, {});

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{isSignup ? "Create your account" : "Sign in"}</CardTitle>
        <CardDescription>
          {isSignup ? "Start tracking and growing your sites' visibility." : "Welcome back to CordiaGrowth."}
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-4">
          <FormError message={state.error} />
          {next && <input type="hidden" name="next" value={next} />}
          {isSignup && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Name</Label>
              <Input id="fullName" name="fullName" autoComplete="name" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state.email}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <SubmitButton className="w-full" pendingText={isSignup ? "Creating account…" : "Signing in…"}>
            {isSignup ? "Create account" : "Sign in"}
          </SubmitButton>
          <p className="text-muted-foreground text-sm">
            {isSignup ? "Already have an account? " : "New here? "}
            <Link
              className="text-foreground underline underline-offset-4"
              href={isSignup ? "/login" : "/signup"}
            >
              {isSignup ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
