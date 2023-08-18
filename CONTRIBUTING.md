# Contributing to TediCross

We're really happy to accept contributions. However we also ask that you follow several rules when doing so.

# Proper base

When opening a PR, please make sure your branch targets the latest release branch, in this case it would be `master`. Also make sure your branch is even with the target branch, to avoid unnecessary surprises.

# Versioning

We follow [SemVer](https://semver.org/) versioning when it comes to pushing stable releases. Ideally, this means you should only be creating PRs for `patch` and `minor` changes. If you wish to introduce a `major` (breaking) change, please discuss it beforehand so we can determine how to integrate it into our next major version. If this involves removing a public facing property/method, mark it with the `Obsolete` attribute instead on the latest release branch.

# Proper titles

When opening issues, make sure the title reflects the purpose of the issue or the pull request. Prefer past tense, and
be brief. Further description belongs inside the issue or PR.

# Descriptive changes

We require the commits describe the change made. It can be a short description. If you fixed or resolved an open issue,
please reference it by using the # notation.

Examples of good commit messages:

- `fix: Fixed a potential memory leak with cache entities. Fixes #142.`
- `feat: Implemented new extension. Resolves #169.`
- `feat!: Changed message cache behavior. It's now global instead of per-channel.`
- `fix: Fixed a potential NRE.`
- ```
  feat!: Changed message cache behavior:

  - Messages are now stored globally.
  - Cache itself is now a ring buffer.
  ```

# Code style

## TODO

# Code changes

One of our requirements is that all code change commits must build successfully. This is verified by our CI.
PRs that do not build will not be accepted.

# Non-code changes

In the event you change something outside of code (i.e. a meta-change or documentation), you must tag your commit with
`docs:`.

# Developer Certificate of Origin (DCO)

```
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```
