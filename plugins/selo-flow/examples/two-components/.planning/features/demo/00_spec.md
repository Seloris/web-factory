# Demo counter (Compteur de démo) — Spec

> **Slug**: `demo`

## TL;DR

A page shows a counter that any signed-in user can increment. It exists to exercise the selo-flow workflow end to end on a project with no real stack.

## Problem

selo-flow needs a feature small enough to plan and implement in minutes, touching both components.

## Goals

- A plan can be written, implemented in two stages and closed on this feature without a real build tool.

## Users & Context

Any signed-in user, from the web component.

## User Stories

- **US-01** — As a signed-in user, I want to see the current counter so that I know where it stands.
- **US-02** — As a signed-in user, I want to increment the counter so that my visit is counted.

## Functional Requirements

- **FR-01** — The API exposes the counter's value and an increment operation.
- **FR-02** — The web page shows the value and a button that increments it.

## Business Rules

- **BR-01** — The counter never goes below zero.
- **BR-02** — An anonymous user can neither read nor increment the counter.
