import pandas as pd
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
ANIMALCLAP_DIR = PROJECT_DIR / "animalclap"

train_file = ANIMALCLAP_DIR / "train.csv"
validation_file = ANIMALCLAP_DIR / "validation.csv"

print("=" * 70)
print("BHOOMI KAVALU - ANIMALCLAP MAMMAL SEARCH")
print("=" * 70)

train = pd.read_csv(train_file, low_memory=False)
validation = pd.read_csv(validation_file, low_memory=False)

df = pd.concat([train, validation], ignore_index=True)

# Keep mammals only
mammals = df[
    df["class"].fillna("").astype(str).str.lower() == "mammalia"
].copy()

print(f"\nTotal mammal recordings: {len(mammals):,}")

# ------------------------------------------------------------
# TIGER / BIG CAT SEARCH
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("BIG CAT / TIGER SEARCH")
print("=" * 70)

big_cats = mammals[
    mammals["family"]
    .fillna("")
    .astype(str)
    .str.lower()
    .isin(["felidae"])
]

print(f"\nFelidae recordings: {len(big_cats):,}")

if len(big_cats) > 0:
    print("\nSpecies found:")
    print(
        big_cats["scientific_name"]
        .value_counts()
        .head(50)
        .to_string()
    )

    print("\nCommon names:")
    print(
        big_cats["common_name"]
        .value_counts()
        .head(50)
        .to_string()
    )

# ------------------------------------------------------------
# DEER SEARCH
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("DEER SEARCH")
print("=" * 70)

deer = mammals[
    mammals["family"]
    .fillna("")
    .astype(str)
    .str.lower()
    .eq("cervidae")
]

print(f"\nCervidae recordings: {len(deer):,}")

if len(deer) > 0:
    print("\nSpecies found:")
    print(
        deer["scientific_name"]
        .value_counts()
        .head(50)
        .to_string()
    )

    print("\nCommon names:")
    print(
        deer["common_name"]
        .value_counts()
        .head(50)
        .to_string()
    )

# ------------------------------------------------------------
# PRINT USEFUL RECORDINGS
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)