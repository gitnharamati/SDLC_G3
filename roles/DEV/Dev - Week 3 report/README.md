# Week 3 Developer Report

## Add Product and Stock Entry

Omkumar Patel · Developer · Student ID 0480176  
Home Décor Course Project · SDLC Team 3

This update let signed-in admins enter products through the website and set stock separately for each size and colour.

## Report for submission

[Download the Week 3 Word report](Team_3_Developer_Weekly_Report.docx)

The Word report is the submission document. This page summarizes the same week’s work for repository readers.

## Work completed

- Added fields for product name, description, material, price and catalogue placement.
- Generated stock rows from the entered sizes and colours.
- Added product visibility so hidden products stay out of the public shop.
- Added server checks for admin access, required values, prices and whole stock quantities. Product details and stock are saved together.
- Used Nir’s admin wireframe as a guide and kept form drafts when a session expired.

## Checks recorded

- Nine automated developer tests passed when the Add Product update was prepared.
- The Angular production build passed.
- Recorded browser checks covered visible and hidden products, prices, stock and draft recovery after signing in again.

## Position at the end of the week

Nir used the live form to enter products. Data loss after redeployment remained open at the time of this report. Hosted storage, photo uploads and editing existing products were the next tasks.

This is a historical weekly record. Later progress is listed in the [developer overview](../README.md).

## Code reference

[Main branch](https://github.com/gitnharamati/SDLC_G3/tree/main)
