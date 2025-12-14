#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("Count3AcZucFDPSFBAeHkQ6AvttieKUkyJ8HiQGhQwe");

#[program]
pub mod clmm {
    use super::*;
    
    pub fn initialize_pool(ctx: Context<InitializePool>, tick_spacing: i32, initial_sqrt_price: u128) -> Result<()> {
        Ok(())
    }

    pub fn open_position(ctx: Context<OpenPosition>, owner: Pubkey, lower_tick: i32, upper_tick: i32, liquidty_amount: u128, _tick_array_lower_start_index: i32, _tick_array_upper_start_index: i32) -> Result<(u64, u64)> {
        Ok(())
    }

    pub fn increase_liquidity(ctx: Context<IncreaseLiquidity>, lower_tick: i32, upper_tick: i32, liquidty_amount: u128) -> Result<(u64, u64)> {
        Ok(())
    }

    pub fn decrease_liquidity(ctx: Context<DecreaseLiquidity>, lower_tick: i32, upper_tick: i32, liquidty_amount: u128) -> Result<(u64, u64)> {
        Ok(())
    }

    pub fn swap(ctx: Context<Swap>, amount_in: u64, swap_token_0_for_1: bool, amount_out_minimum: u64) -> Result<u64> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeCounter<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
  init,
  space = 8 + Counter::INIT_SPACE,
  payer = payer
    )]
    pub counter: Account<'info, Counter>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub token_mint_0: Pubkey,
    pub token_mint_1: Pubkey,
    pub token_vault_0: Pubkey,
    pub token_vault_1: Pubkey,
    pub global_liquidity: u128,
    pub sqrt_price_x96: u128,
    pub current_tick: i32,
    pub tick_spacing: i32,
    pub bump: u8,
}

impl Pool {
    pub const SPACE: usize = 8 + // discriminator
        32 + // token_mint_0
        32 + // token_mint_1
        32 + //token_vault_0
        32 + //token_vault_1
        16 + // global_liquidity
        16 + // sqrt_price_x96
        4 + //current_tick
        4 + //tick_spacing
        1; //bump
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub liquidity: u128,
    pub tick_lower: i32,
    pub tick_upper: i32,
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub bump: u8,
}

impl Position {
    pub const SPACE: usize = 8 + //discriminator
        16 + // liquidity
        4 + // tick_lower
        4 + // tick_upper
        32 + // owner
        32 + // pool
        1; // bump
}

#[account]
#[derive(InitSpace)]
pub struct TickInfo {
    pub initialized: bool,
    pub liquidity_gross: u128,
    pub liquidity_net: i128,
}

impl TickInfo {
    pub const SPACE: usize = 8 + // discriminator
        1 + // initialized
        16 + // liquidity_gross
        16; // liquidity_net

    pub fn update_liquidity(&mut self, liquidity_delta: i128, is_lower: bool) -> Result<()> {
        if !self.initialized {
            self.initialized = true;
        }

        self.liquidity_gross = self.liquidity_gross
            .checked_add(liquidity_delta.unsigned_abs())
            .ok_or(ClmmError::ArithmeticOverflow)?;
        if is_lower {
            self.liquidity_net = self.liquidity_net
                .checked_add(liquidity_delta)
                .ok_or(ClmmError::ArithmeticOverflow)?;
        } else {
            self.liquidity_net = self.liquidity_net
                .checked_sub(liquidity_delta)
                .ok_or(ClmmError::ArithmeticOverflow)?;
        }
        Ok(())
    }
}

pub const TICKS_PER_ARRAY: usize = 30;

#[account]
#[derive(InitSpace)]
pub struct TickArray {
    pub pool: Pubkey,
    pub starting_tick: i32,
    pub ticks: [TickInfo; TICKS_PER_ARRAY],
    pub bump: u8
}

pub fn get_sqrt_price_from_tick(tick: i32) -> Result<u128> {
    // this is a simplified logic // logarithmic
    let base_sqrt_price = 1u128 << 96;
    let adjusted_factor = 1_000_000_000 / 1000;
    let adjusted_price = base_sqrt_price
        .checked_add_signed((tick as i128) * (adjusted_factor as i128))
        .ok_or(ClmmError::ArithmeticOverflow)?;
    Ok(adjusted_price)
}

pub fn get_tick_at_sqrt_price(sqrt_price_x96: u128) -> Result<i32> {
    let base_sqrt_price = 1u128 << 96;
    let adjustment_factor = 1_000_000_000 / 1000;

    let diff = sqrt_price_x96 as i128 - base_sqrt_price as i128;
    let tick = diff
        .checked_div(adjustment_factor as i128)
        .ok_or(ClmmError::ArithmeticOverflow)? as i32;
    Ok(tick)
}

pub fn get_amounts_for_liquidity(current_sqrt_price_x96: u128, lower_sqrt_price_x96: u128, upper_sqrt_price_x96: u128, liquidity: u128) -> Result<(u64, u64)> {
    let amount0: u64;
    let amount1: u64;

    if current_sqrt_price_x96 >= lower_sqrt_price_x96 && current_sqrt_price_x96 < upper_sqrt_price_x96 {
        amount0 = (liquidity / 2) as u64;
        amount1 = (liquidity / 2) as u64;
    } else if current_sqrt_price_x96 < lower_sqrt_price_x96 {
        amount0 = liquidity as u64;
        amount1 = 0;
    } else {
        amount0 = 0;
        amount1 = liquidity as u64;
    }
    Ok((amount0, amount1))
}

pub fn swap_segment(current_sqrt_price_x96: u128, global_liquidity: u128, amount_remaining_in: u64, swap_token_0_for_1: bool) -> Result<(u64, u64, u128)> {
    if global_liquidity == 0 {
        return Err(ClmmError::InsufficientLiquidity.into());
    }

    let amount_in_used = amount_remaining_in;
    // this is a simplified calculation, not real AMM
    let amount_out_calculated = amount_in_used
        .checked_sub(amount_in_used / 1000)
        .ok_or(ClmmError::ArithmeticOverflow)?; // Simple 0.1% fee

    let new_sqrt_price = if swap_token_0_for_1 {
        current_sqrt_price_x96
            .checked_sub(1_000_000_000)
            .ok_or(ClmmError::ArithmeticOverflow)?
    } else {
        // Swapping token 1 for 0, price of token 0 in terms of 1 increase
        current_sqrt_price_x96
            .checked_add(1_000_000_000)
            .ok_or(ClmmError::ArithmeticOverflow)?
    };
    Ok((amount_in_used, amount_out_calculated, new_sqrt_price))
}

#[error_code]
pub enum ClmmError {
    #[msg("Arithmetic Overflow")]
    ArithmeticOverflow,
    #[msg("Invalid Tick Range")]
    InvalidTickRange,
    #[msg("Insufficient Input Amount")]
    InsufficientInputAmount,
    #[msg("Slippage Exceeded")]
    SlippageExceeded,
    #[msg("Insufficient Liquidity")]
    InsufficientLiquidity,
    #[msg("Invalid Tick Spacing")]
    InvalidTickSpacing,
    #[msg("Invalid Price")]
    InvalidPrice,
    #[msg("Invalid Position Owner")]
    InvalidPositionOwner,
    #[msg("Invalid Position Range")]
    InvalidPositionRange,
    #[msg("Tick Not Found")]
    TickNotFound,
    #[msg("Token 0 Transfer Failed")]
    Token0TransferFailed,
    #[msg("Token 1 Transfer Failed")]
    Token1TransferFailed,
    #[msg("Invalid Bump")]
    InvalidBump,
    #[msg("Invalid Tick Array Account")]
    InvalidTickArrayAccount,
    #[msg("Invalid Token Pair")]
    InvalidTokenPair,
    #[msg("Mint Range Must Cover Current Price")]
    MintRangeMustCoverCurrentPrice,
    #[msg("Burn Range Must Cover Current Price")]
    BurnRangeMustCoverCurrentPrice,
    #[msg("Insufficient Pool Liquidity")]
    InsufficientPoolLiquidity,
    #[msg("Invalid Pool Liquidity")]
    InvalidPoolLiquidity,
    #[msg("No Liquidity To Remove")]
    NoLiquidityToRemove,
    #[msg("Invalid Tick Array Start Index")]
    InvalidTickArrayStartIndex,
    #[msg("Invalid Tick Array Bump")]
    InvalidTickArrayBump,
    #[msg("Invalid Tick Array Pool")]
    InvalidTickArrayPool,
}