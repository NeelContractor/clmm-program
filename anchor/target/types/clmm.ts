/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/clmm.json`.
 */
export type Clmm = {
  "address": "88KQMA65EwtZwyFCF16mAMZgNPjdcQCSwr2PXnMsKFEZ",
  "metadata": {
    "name": "clmm",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "decreaseLiquidity",
      "discriminator": [
        160,
        38,
        208,
        111,
        104,
        91,
        44,
        1
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "lowerTickArray",
          "writable": true
        },
        {
          "name": "upperTickArray",
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "userToken0",
          "writable": true
        },
        {
          "name": "userToken1",
          "writable": true
        },
        {
          "name": "poolToken0",
          "writable": true
        },
        {
          "name": "poolToken1",
          "writable": true
        },
        {
          "name": "tokenMint0",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "tokenMint1",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u128"
        }
      ]
    },
    {
      "name": "increaseLiquidity",
      "discriminator": [
        46,
        156,
        243,
        118,
        13,
        205,
        251,
        178
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "lowerTickArray",
          "writable": true
        },
        {
          "name": "upperTickArray",
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "userToken0",
          "writable": true
        },
        {
          "name": "userToken1",
          "writable": true
        },
        {
          "name": "poolToken0",
          "writable": true
        },
        {
          "name": "poolToken1",
          "writable": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenMint0",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "tokenMint1",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u128"
        }
      ]
    },
    {
      "name": "initializePool",
      "discriminator": [
        95,
        180,
        10,
        172,
        84,
        174,
        232,
        40
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint0"
              },
              {
                "kind": "account",
                "path": "tokenMint1"
              },
              {
                "kind": "arg",
                "path": "tickSpacing"
              }
            ]
          }
        },
        {
          "name": "tokenMint0"
        },
        {
          "name": "tokenMint1"
        },
        {
          "name": "tokenVault0",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenVault1",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tickSpacing",
          "type": "i32"
        },
        {
          "name": "initialSqrtPrice",
          "type": "u128"
        }
      ]
    },
    {
      "name": "openPosition",
      "discriminator": [
        135,
        128,
        47,
        77,
        15,
        152,
        240,
        49
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "lowerTickArray",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  99,
                  107,
                  95,
                  97,
                  114,
                  114,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "arg",
                "path": "tickArrayLowerStartIndex"
              }
            ]
          }
        },
        {
          "name": "upperTickArray",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  99,
                  107,
                  95,
                  97,
                  114,
                  114,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "arg",
                "path": "tickArrayUpperStartIndex"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "arg",
                "path": "lowerTick"
              },
              {
                "kind": "arg",
                "path": "upperTick"
              }
            ]
          }
        },
        {
          "name": "userToken0",
          "writable": true
        },
        {
          "name": "userToken1",
          "writable": true
        },
        {
          "name": "poolToken0",
          "writable": true
        },
        {
          "name": "poolToken1",
          "writable": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenMint0",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "tokenMint1",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "owner",
          "type": "pubkey"
        },
        {
          "name": "lowerTick",
          "type": "i32"
        },
        {
          "name": "upperTick",
          "type": "i32"
        },
        {
          "name": "liquidityAmount",
          "type": "u128"
        },
        {
          "name": "tickArrayLowerStartIndex",
          "type": "i32"
        },
        {
          "name": "tickArrayUpperStartIndex",
          "type": "i32"
        }
      ]
    },
    {
      "name": "swap",
      "discriminator": [
        248,
        198,
        158,
        145,
        225,
        117,
        135,
        200
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "userToken0",
          "writable": true
        },
        {
          "name": "userToken1",
          "writable": true
        },
        {
          "name": "poolToken0",
          "writable": true
        },
        {
          "name": "poolToken1",
          "writable": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amountIn",
          "type": "u64"
        },
        {
          "name": "swapToken0For1",
          "type": "bool"
        },
        {
          "name": "amountOutMinimum",
          "type": "u64"
        }
      ],
      "returns": "u64"
    }
  ],
  "accounts": [
    {
      "name": "pool",
      "discriminator": [
        241,
        154,
        109,
        4,
        17,
        177,
        109,
        188
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    },
    {
      "name": "tickArray",
      "discriminator": [
        69,
        97,
        189,
        190,
        110,
        7,
        66,
        187
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic Overflow"
    },
    {
      "code": 6001,
      "name": "invalidTickRange",
      "msg": "Invalid Tick Range"
    },
    {
      "code": 6002,
      "name": "insufficientInputAmount",
      "msg": "Insufficient Input Amount"
    },
    {
      "code": 6003,
      "name": "slippageExceeded",
      "msg": "Slippage Exceeded"
    },
    {
      "code": 6004,
      "name": "insufficientLiquidity",
      "msg": "Insufficient Liquidity"
    },
    {
      "code": 6005,
      "name": "invalidTickSpacing",
      "msg": "Invalid Tick Spacing"
    },
    {
      "code": 6006,
      "name": "invalidPositionOwner",
      "msg": "Invalid Position Owner"
    },
    {
      "code": 6007,
      "name": "invalidPositionRange",
      "msg": "Invalid Position Range"
    },
    {
      "code": 6008,
      "name": "invalidTokenPair",
      "msg": "Invalid Token Pair"
    },
    {
      "code": 6009,
      "name": "mintRangeMustCoverCurrentPrice",
      "msg": "Mint Range Must Cover Current Price"
    },
    {
      "code": 6010,
      "name": "burnRangeMustCoverCurrentPrice",
      "msg": "Burn Range Must Cover Current Price"
    },
    {
      "code": 6011,
      "name": "insufficientPoolLiquidity",
      "msg": "Insufficient Pool Liquidity"
    },
    {
      "code": 6012,
      "name": "noLiquidityToRemove",
      "msg": "No Liquidity To Remove"
    },
    {
      "code": 6013,
      "name": "tickNotFound",
      "msg": "Tick Not Found"
    },
    {
      "code": 6014,
      "name": "invalidTickArrayIndex",
      "msg": "Invalid Tick Array Index"
    }
  ],
  "types": [
    {
      "name": "pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint0",
            "type": "pubkey"
          },
          {
            "name": "tokenMint1",
            "type": "pubkey"
          },
          {
            "name": "tokenVault0",
            "type": "pubkey"
          },
          {
            "name": "tokenVault1",
            "type": "pubkey"
          },
          {
            "name": "globalLiquidity",
            "type": "u128"
          },
          {
            "name": "sqrtPriceX96",
            "type": "u128"
          },
          {
            "name": "currentTick",
            "type": "i32"
          },
          {
            "name": "tickSpacing",
            "type": "i32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "position",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "liquidity",
            "type": "u128"
          },
          {
            "name": "tickLower",
            "type": "i32"
          },
          {
            "name": "tickUpper",
            "type": "i32"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tickArray",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "startingTick",
            "type": "i32"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "ticks",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "tickInfo"
                  }
                },
                30
              ]
            }
          }
        ]
      }
    },
    {
      "name": "tickInfo",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "liquidityGrossLower",
            "type": "u64"
          },
          {
            "name": "liquidityGrossUpper",
            "type": "u64"
          },
          {
            "name": "liquidityNetLower",
            "type": "u64"
          },
          {
            "name": "liquidityNetUpper",
            "type": "u64"
          },
          {
            "name": "initialized",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
