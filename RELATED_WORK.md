# Related work and safety references

Primary sources were checked on 31 October 2026. This is a targeted search, not an exhaustive systematic review and not proof of worldwide novelty. No images, code or records from these projects were copied into this dataset.

| Source | Existing coverage | Our proposed focus / limit |
|---|---|---|
| [WebPII, Zhao 2026](https://arxiv.org/abs/2603.17357) | Synthetic visual PII benchmark in e-commerce interfaces; held-out page-type evaluation | Turkish developer/operations and personal-data roles, paired context controls. We do not exceed its scale or claim to introduce screenshot PII detection. |
| [ScreenLeak, official repository](https://github.com/screenpipe/screenleak) | Text/image/trace redaction evaluation, synthetic app screenshots and region labels | Fully local reproducible generator and open pair metadata for this specific Turkish context task. Shared ideas such as pixel labels or synthetic interfaces are prior art. No comparative model score has been run. |
| [VPD-100K, ICML 2026 proceedings](https://proceedings.mlr.press/v306/hu26bk.html) | Broad fine-grained visual privacy detection and complex scenes | Our narrow developer-screen task is complementary and much smaller. We make no broad visual-privacy superiority claim. |

EVREN's earlier inspection also found large synthetic KVKK/UI datasets and phishing datasets. A generic synthetic UI/PII corpus would be insufficient differentiation. This release therefore contributes explicit paired same-value decisions, grouped splits, benign-region metadata, independent reproducibility and audit artifacts. Research benefit remains a hypothesis until controlled model/transfer experiments exist.

Safety references:

- [RFC 2606](https://www.rfc-editor.org/rfc/rfc2606.html): `.example` is reserved for documentation. All generated hosts remain below that TLD.
- [TCMB IBAN communiqué](https://www.tcmb.gov.tr/wps/wcm/connect/c8357e06-1ab6-4c49-8352-7b9c19fcb77e/Teblig%2B2021_5.pdf?MOD=AJPERES): Turkey's IBAN structure. We reproduce a 26-character appearance and deliberately fail the local MOD97 guard; no live bank lookup occurs.
- [TKGM official anti-forgery training material](https://www.tkgm.gov.tr/sites/default/files/2023-06/SAHTE%20%20L%C4%B0HKAB%202023.pdf): a national identity number cannot start with zero. We use leading zero and odd final digit plus local check guards. This cited training material is not an authorization to process real identities.
- [BTK general numbering plan](https://www.btk.gov.tr/genel-numaralandirma-plani): published national numbering allocations. `000` is used as an intentionally invalid target code rather than a sampled subscriber prefix. No phone is called or externally validated.

These sources document chosen format constraints, not legal certification of the dataset. Source licensing governs the fonts and local code separately; references do not confer their authors' endorsement.
