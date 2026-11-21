# Conditional Critic Success Model from Static Features

The [agreed workflow](critic-ast-bayesian-workflow-2026-11-21.md) connects feature and outcome collection, Bayesian learning, review admission, compilation overlap, and verified feedback.

The intended model maps AST-derived feature values directly to the probability that a fixed Critic produces an independently verified counterexample under a fixed budget. Manually grouping code into a few buckets is not the target architecture. The previous Beta-Bernoulli walkthrough was an illustrative frequency baseline and does not establish that its grouping rules are useful.

## Prediction target

Let x be the feature vector available at the decision time and Y indicate a verified counterexample. Estimate `P(Y = 1 | x, problem context, Critic configuration, budget, training data)`. This estimates an observable Critic outcome, not an exact oracle probability for code incorrectness. The same code can satisfy one specification and violate another, and detection depends on the Critic and its budget.

For an initial model, keep the problem regime, language, Critic prompt/model and budgets fixed or encode their differences explicitly. Use validated problem metadata when available; do not silently infer requirements from code. No numerical probability is justified yet because this conditional model has not been fitted or evaluated.

## Inputs and labels

Retain one row per eligible reviewed snapshot with its full feature vector and observed outcome. Do not replace those rows with global success/failure totals.

Candidate inputs include nonempty lines or token count, branch count, maximum loop nesting, declared container indicators, index dimensionality, recursion indicators, conditional deletion or overwrite sites, and available analyzer diagnostics. Record unknown complexity bounds with explicit missingness indicators. An approximate or unavailable Big-O estimate must not be presented as an exact measured feature.

Use training-only preprocessing: standardize or log-transform count features as appropriate and encode container presence with separate indicators. Preserve continuous and ordinal information instead of reducing every value to an arbitrary bucket. Begin with a compact feature set; add a few predeclared interactions if needed, such as nesting multiplied by a conditional-state-deletion indicator. An interaction allows an effect to depend on another feature without enumerating all combinations as independent groups.

Y = 1 requires independently confirmed evidence within the configured review and verification budgets. Y = 0 means an eligible attempted review did not produce such evidence; it does not mean the code is correct. Skipped reviews are unlabeled. Infrastructure failures are excluded from this learning label and recorded separately. Keep translations, revisions and repeated calls for one underlying problem together during evaluation.

Observing only feature values estimates how common those values are, not how likely the Critic is to find a problem. Critic outcomes, or other valid externally supplied labels for the same target, are needed to learn that relationship. The distinction is between retaining labeled feature/outcome pairs and merely aggregating successes and failures.

## First candidate model

A Bayesian logistic regression is a suitable small candidate to test, not a claim that it is the best model. Define:

`z_i = b + sum_j(w_j * x_ij) + selected interaction terms`

`p_i = sigmoid(z_i) = 1 / (1 + exp(-z_i))`

`Y_i | x_i, b, w ~ Bernoulli(p_i)`

The AST measurements x are observed features. The intercept b and coefficients w are the model parameters to infer. Coefficients capture statistical associations conditional on the model; they do not prove causal effects or algorithmic incorrectness. An additive logit alone cannot express every interaction or semantic distinction.

Use regularizing priors on standardized coefficients, for example zero-centered normal distributions whose scales are checked through prior predictive analysis. Choose an intercept prior using a separately justified base-rate assumption, or an explicitly weak initial assumption; do not treat the deliberately faulty timing fixtures as a natural defect prevalence estimate. A Beta distribution is not required for these coefficients or the final predictive probability.

The posterior is proportional to the prior on coefficients multiplied by the likelihood of all labeled feature/outcome pairs. It therefore learns which features and selected combinations are associated with verified Critic outcomes, rather than assigning a fixed rate to each hand-built group. Unlike the Beta-Bernoulli bucket example, the posterior generally has no simple two-counter update. A small implementation can use a checked Laplace approximation or posterior sampling; the inference method and approximation quality must be recorded.

For new features x*, predict by averaging `sigmoid(b + w*x\* + interactions)` over the coefficient posterior. This is not generally identical to applying sigmoid to the posterior mean coefficients. Posterior variation can provide uncertainty about the estimated success probability, subject to the model's assumptions. Neither Bayesian inference nor a narrow interval guarantees calibration on a different code distribution.

The statistical building blocks are documented in the [Stan regression guide](https://mc-stan.org/docs/stan-users-guide/regression.html#logistic-and-probit-regression) and [posterior prediction guide](https://mc-stan.org/docs/stan-users-guide/posterior-prediction.html).

## Resource decision remains separate

The model returns a conditional success estimate and its uncertainty. A separate policy combines that estimate with expected Critic and verification cost to choose skip or review. For an admitted review, build time and resource availability determine whether to start early or later. Low-value reviews need not run after compilation.

Evaluate probability calibration and held-out predictive performance before claiming a useful admission policy. Then compare confirmed findings and audited missed findings at a fixed token/compute budget against always-review and simple baselines. Use budgeted audits of skipped cases or a fully reviewed evaluation sample to expose selection bias.

## Current implementation status

The C++ AST inspection and archived timing pilots are real measurements. The earlier bucket counts and 64.3 percent calculation were hypothetical. No Bayesian logistic model has been trained, no learned coefficient values are available, and the production predictor is unchanged. This document corrects the planned model specification without introducing another experiment or fitting a model to the four deliberately faulty translations.
