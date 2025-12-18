#![allow(clippy::result_large_err)]
#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use bytemuck::{Pod, Zeroable};

declare_id!("88KQMA65EwtZwyFCF16mAMZgNPjdcQCSwr2PXnMsKFEZ");

#[program]
pub mod clmm {
    use super::*;
    
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        tick_spacing: i32,
        initial_sqrt_price: u128,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        require!(tick_spacing > 0, ClmmError::InvalidTickSpacing);
        require!(
            ctx.accounts.token_mint_0.key() != ctx.accounts.token_mint_1.key(),
            ClmmError::InvalidTokenPair
        );

        pool.token_mint_0 = ctx.accounts.token_mint_0.key();
        pool.token_mint_1 = ctx.accounts.token_mint_1.key();
        pool.token_vault_0 = ctx.accounts.token_vault_0.key();
        pool.token_vault_1 = ctx.accounts.token_vault_1.key();
        pool.global_liquidity = 0;
        pool.sqrt_price_x96 = initial_sqrt_price;
        pool.current_tick = get_tick_at_sqrt_price(initial_sqrt_price)?;
        pool.tick_spacing = tick_spacing;
        pool.bump = ctx.bumps.pool;
        
        Ok(())
    }

    pub fn open_position(
        ctx: Context<OpenPosition>,
        owner: Pubkey,
        lower_tick: i32,
        upper_tick: i32,
        liquidity_amount: u128,
        _tick_array_lower_start_index: i32,
        _tick_array_upper_start_index: i32,
    ) -> Result<(u64, u64)> {
        let pool = &mut ctx.accounts.pool;
        let position = &mut ctx.accounts.position;

        require!(lower_tick < upper_tick, ClmmError::InvalidTickRange);
        require!(
            lower_tick % pool.tick_spacing == 0,
            ClmmError::InvalidTickRange
        );
        require!(
            upper_tick % pool.tick_spacing == 0,
            ClmmError::InvalidTickRange
        );
        require!(liquidity_amount > 0, ClmmError::InsufficientInputAmount);

        // Load and initialize tick arrays if needed
        let lower_tick_array = &mut ctx.accounts.lower_tick_array.load_init()?;
        let upper_tick_array = &mut ctx.accounts.upper_tick_array.load_init()?;

        if lower_tick_array.pool == Pubkey::default() {
            lower_tick_array.pool = pool.key();
            lower_tick_array.starting_tick = _tick_array_lower_start_index;
        }

        if upper_tick_array.pool == Pubkey::default() {
            upper_tick_array.pool = pool.key();
            upper_tick_array.starting_tick = _tick_array_upper_start_index;
        }

        // Update tick info
        let lower_tick_info = lower_tick_array.get_tick_info_mutable(lower_tick, pool.tick_spacing)?;
        let upper_tick_info = upper_tick_array.get_tick_info_mutable(upper_tick, pool.tick_spacing)?;

        lower_tick_info.update_liquidity(liquidity_amount as i128, true)?;
        upper_tick_info.update_liquidity(liquidity_amount as i128, false)?;

        let (amount_0, amount_1) = get_amounts_for_liquidity(
            pool.sqrt_price_x96,
            get_sqrt_price_from_tick(lower_tick)?,
            get_sqrt_price_from_tick(upper_tick)?,
            liquidity_amount,
        )?;

        if position.liquidity == 0 && position.owner == Pubkey::default() {
            position.owner = owner;
            position.pool = pool.key();
            position.tick_lower = lower_tick;
            position.tick_upper = upper_tick;
            position.liquidity = liquidity_amount;
            position.bump = ctx.bumps.position;
        } else {
            require!(position.owner == owner, ClmmError::InvalidPositionOwner);
            require!(
                position.tick_lower == lower_tick && position.tick_upper == upper_tick,
                ClmmError::InvalidPositionRange
            );
            position.liquidity = position
                .liquidity
                .checked_add(liquidity_amount)
                .ok_or(ClmmError::ArithmeticOverflow)?;
        }
        
        pool.global_liquidity = pool
            .global_liquidity
            .checked_add(liquidity_amount)
            .ok_or(ClmmError::ArithmeticOverflow)?;

        if amount_0 > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_token_0.to_account_info(),
                        to: ctx.accounts.pool_token_0.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                amount_0,
            )?;
        }

        if amount_1 > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_token_1.to_account_info(),
                        to: ctx.accounts.pool_token_1.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                amount_1,
            )?;
        }

        Ok((amount_0, amount_1))
    }

    pub fn increase_liquidity(
        ctx: Context<IncreaseLiquidity>,
        liquidity_amount: u128,
    ) -> Result<(u64, u64)> {
        let pool = &mut ctx.accounts.pool;
        let position = &mut ctx.accounts.position;

        require!(liquidity_amount > 0, ClmmError::InsufficientInputAmount);

        // Update tick arrays
        let lower_tick_array = &mut ctx.accounts.lower_tick_array.load_mut()?;
        let upper_tick_array = &mut ctx.accounts.upper_tick_array.load_mut()?;

        let lower_tick_info = lower_tick_array.get_tick_info_mutable(position.tick_lower, pool.tick_spacing)?;
        let upper_tick_info = upper_tick_array.get_tick_info_mutable(position.tick_upper, pool.tick_spacing)?;

        lower_tick_info.update_liquidity(liquidity_amount as i128, true)?;
        upper_tick_info.update_liquidity(liquidity_amount as i128, false)?;

        position.liquidity = position
            .liquidity
            .checked_add(liquidity_amount)
            .ok_or(ClmmError::ArithmeticOverflow)?;

        let (amount_0, amount_1) = get_amounts_for_liquidity(
            pool.sqrt_price_x96,
            get_sqrt_price_from_tick(position.tick_lower)?,
            get_sqrt_price_from_tick(position.tick_upper)?,
            liquidity_amount,
        )?;

        pool.global_liquidity = pool
            .global_liquidity
            .checked_add(liquidity_amount)
            .ok_or(ClmmError::ArithmeticOverflow)?;

        if amount_0 > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_token_0.to_account_info(),
                        to: ctx.accounts.pool_token_0.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                amount_0,
            )?;
        }

        if amount_1 > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_token_1.to_account_info(),
                        to: ctx.accounts.pool_token_1.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                amount_1,
            )?;
        }

        Ok((amount_0, amount_1))
    }

    pub fn decrease_liquidity(
        ctx: Context<DecreaseLiquidity>,
        liquidity_amount: u128,
    ) -> Result<(u64, u64)> {
        let pool = &mut ctx.accounts.pool;
        let position = &mut ctx.accounts.position;

        require!(liquidity_amount > 0, ClmmError::InsufficientInputAmount);
        require!(
            position.liquidity >= liquidity_amount,
            ClmmError::NoLiquidityToRemove
        );

        // Update tick arrays
        let lower_tick_array = &mut ctx.accounts.lower_tick_array.load_mut()?;
        let upper_tick_array = &mut ctx.accounts.upper_tick_array.load_mut()?;

        let lower_tick_info = lower_tick_array.get_tick_info_mutable(position.tick_lower, pool.tick_spacing)?;
        let upper_tick_info = upper_tick_array.get_tick_info_mutable(position.tick_upper, pool.tick_spacing)?;

        lower_tick_info.update_liquidity_decrease(liquidity_amount as i128, true)?;
        upper_tick_info.update_liquidity_decrease(liquidity_amount as i128, false)?;

        position.liquidity = position
            .liquidity
            .checked_sub(liquidity_amount)
            .ok_or(ClmmError::ArithmeticOverflow)?;

        let (amount_0, amount_1) = get_amounts_for_liquidity(
            pool.sqrt_price_x96,
            get_sqrt_price_from_tick(position.tick_lower)?,
            get_sqrt_price_from_tick(position.tick_upper)?,
            liquidity_amount,
        )?;

        pool.global_liquidity = pool
            .global_liquidity
            .checked_sub(liquidity_amount)
            .ok_or(ClmmError::ArithmeticOverflow)?;

        if amount_0 > 0 {
            let seeds = [
                b"pool",
                pool.token_mint_0.as_ref(),
                pool.token_mint_1.as_ref(),
                &pool.tick_spacing.to_le_bytes(),
                &[pool.bump],
            ];
            let signer_seeds = &[&seeds[..]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.pool_token_0.to_account_info(),
                        to: ctx.accounts.user_token_0.to_account_info(),
                        authority: pool.to_account_info(),
                    },
                    signer_seeds,
                ),
                amount_0,
            )?;
        }

        if amount_1 > 0 {
            let seeds = [
                b"pool",
                pool.token_mint_0.as_ref(),
                pool.token_mint_1.as_ref(),
                &pool.tick_spacing.to_le_bytes(),
                &[pool.bump],
            ];
            let signer_seeds = &[&seeds[..]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.pool_token_1.to_account_info(),
                        to: ctx.accounts.user_token_1.to_account_info(),
                        authority: pool.to_account_info(),
                    },
                    signer_seeds,
                ),
                amount_1,
            )?;
        }
        
        Ok((amount_0, amount_1))
    }

    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        swap_token_0_for_1: bool,
        amount_out_minimum: u64,
    ) -> Result<u64> {
        let pool = &mut ctx.accounts.pool;

        require!(pool.global_liquidity > 0, ClmmError::InsufficientPoolLiquidity);
        require!(amount_in > 0, ClmmError::InsufficientInputAmount);

        let (amount_in_used, amount_out_calculated, new_sqrt_price_x96) =
            swap_segment(pool.sqrt_price_x96, pool.global_liquidity, amount_in, swap_token_0_for_1)?;

        require!(
            amount_out_calculated >= amount_out_minimum,
            ClmmError::SlippageExceeded
        );

        let seeds = [
            b"pool",
            pool.token_mint_0.as_ref(),
            pool.token_mint_1.as_ref(),
            &pool.tick_spacing.to_le_bytes(),
            &[pool.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        if swap_token_0_for_1 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_token_0.to_account_info(),
                        to: ctx.accounts.pool_token_0.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                amount_in_used,
            )?;

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.pool_token_1.to_account_info(),
                        to: ctx.accounts.user_token_1.to_account_info(),
                        authority: pool.to_account_info(),
                    },
                    signer_seeds,
                ),
                amount_out_calculated,
            )?;
        } else {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_token_1.to_account_info(),
                        to: ctx.accounts.pool_token_1.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                amount_in_used,
            )?;

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.pool_token_0.to_account_info(),
                        to: ctx.accounts.user_token_0.to_account_info(),
                        authority: pool.to_account_info(),
                    },
                    signer_seeds,
                ),
                amount_out_calculated,
            )?;
        }

        pool.sqrt_price_x96 = new_sqrt_price_x96;
        pool.current_tick = get_tick_at_sqrt_price(new_sqrt_price_x96)?;

        Ok(amount_out_calculated)
    }
}

#[derive(Accounts)]
#[instruction(tick_spacing: i32)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = Pool::SPACE,
        seeds = [
            b"pool",
            token_mint_0.key().as_ref(),
            token_mint_1.key().as_ref(),
            &tick_spacing.to_le_bytes()
        ],
        bump,
    )]
    pub pool: Account<'info, Pool>,

    pub token_mint_0: Account<'info, Mint>,
    pub token_mint_1: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        token::mint = token_mint_0,
        token::authority = pool,
    )]
    pub token_vault_0: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = payer,
        token::mint = token_mint_1,
        token::authority = pool,
    )]
    pub token_vault_1: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(owner: Pubkey, lower_tick: i32, upper_tick: i32, liquidity_amount: u128, tick_array_lower_start_index: i32, tick_array_upper_start_index: i32)]
pub struct OpenPosition<'info> {
    #[account(
        mut,
        has_one = token_mint_0,
        has_one = token_mint_1,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + std::mem::size_of::<TickArray>(),
        seeds = [b"tick_array", pool.key().as_ref(), &tick_array_lower_start_index.to_le_bytes()],
        bump
    )]
    pub lower_tick_array: AccountLoader<'info, TickArray>,
    
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + std::mem::size_of::<TickArray>(),
        seeds = [b"tick_array", pool.key().as_ref(), &tick_array_upper_start_index.to_le_bytes()],
        bump
    )]
    pub upper_tick_array: AccountLoader<'info, TickArray>,

    #[account(
        init_if_needed,
        payer = payer,
        space = Position::SPACE,
        seeds = [
            b"position",
            owner.as_ref(),
            pool.key().as_ref(),
            &lower_tick.to_le_bytes(),
            &upper_tick.to_le_bytes(),
        ],
        bump
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(mut)]
    pub user_token_0: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_1: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_0: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_1: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_mint_0: Account<'info, Mint>,
    pub token_mint_1: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct IncreaseLiquidity<'info> {
    #[account(
        mut,
        has_one = token_mint_0,
        has_one = token_mint_1,
    )]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub lower_tick_array: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub upper_tick_array: AccountLoader<'info, TickArray>,

    #[account(
        mut,
        constraint = position.pool == pool.key() @ ClmmError::InvalidPositionRange,
        constraint = position.owner == payer.key() @ ClmmError::InvalidPositionOwner,
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(mut, token::mint = token_mint_0)]
    pub user_token_0: Account<'info, TokenAccount>,
    #[account(mut, token::mint = token_mint_1)]
    pub user_token_1: Account<'info, TokenAccount>,
    #[account(mut, token::mint = token_mint_0)]
    pub pool_token_0: Account<'info, TokenAccount>,
    #[account(mut, token::mint = token_mint_1)]
    pub pool_token_1: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_mint_0: Account<'info, Mint>,
    pub token_mint_1: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DecreaseLiquidity<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        mut,
        has_one = token_mint_0,
        has_one = token_mint_1,
    )]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub lower_tick_array: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub upper_tick_array: AccountLoader<'info, TickArray>,

    #[account(
        mut,
        constraint = position.pool == pool.key() @ ClmmError::InvalidPositionRange,
        constraint = position.owner == payer.key() @ ClmmError::InvalidPositionOwner,
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(mut, token::mint = token_mint_0)]
    pub user_token_0: Account<'info, TokenAccount>,
    #[account(mut, token::mint = token_mint_1)]
    pub user_token_1: Account<'info, TokenAccount>,
    #[account(mut, token::mint = token_mint_0)]
    pub pool_token_0: Account<'info, TokenAccount>,
    #[account(mut, token::mint = token_mint_1)]
    pub pool_token_1: Account<'info, TokenAccount>,

    pub token_mint_0: Account<'info, Mint>,
    pub token_mint_1: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub user_token_0: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_1: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_0: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_1: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
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
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 32 + 16 + 16 + 4 + 4 + 1;
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
    pub const SPACE: usize = 8 + 16 + 4 + 4 + 32 + 32 + 1;
}

#[zero_copy]
#[repr(C)]
pub struct TickInfo {
    pub liquidity_gross_lower: u64,
    pub liquidity_gross_upper: u64,
    pub liquidity_net_lower: u64,
    pub liquidity_net_upper: u64,
    pub initialized: u64,
}

impl Default for TickInfo {
    fn default() -> Self {
        Self {
            liquidity_gross_lower: 0,
            liquidity_gross_upper: 0,
            liquidity_net_lower: 0,
            liquidity_net_upper: 0,
            initialized: 0,
        }
    }
}

impl TickInfo {
    pub fn is_initialized(&self) -> bool {
        self.initialized != 0
    }

    fn get_liquidity_gross(&self) -> u128 {
        ((self.liquidity_gross_upper as u128) << 64) | (self.liquidity_gross_lower as u128)
    }

    fn set_liquidity_gross(&mut self, value: u128) {
        self.liquidity_gross_lower = value as u64;
        self.liquidity_gross_upper = (value >> 64) as u64;
    }

    fn get_liquidity_net(&self) -> i128 {
        let combined = ((self.liquidity_net_upper as u128) << 64) | (self.liquidity_net_lower as u128);
        combined as i128
    }

    fn set_liquidity_net(&mut self, value: i128) {
        let as_u128 = value as u128;
        self.liquidity_net_lower = as_u128 as u64;
        self.liquidity_net_upper = (as_u128 >> 64) as u64;
    }

    pub fn update_liquidity(&mut self, liquidity_delta: i128, is_lower: bool) -> Result<()> {
        if self.initialized == 0 {
            self.initialized = 1;
        }

        let current_gross = self.get_liquidity_gross();
        let new_gross = current_gross
            .checked_add(liquidity_delta.unsigned_abs())
            .ok_or(ClmmError::ArithmeticOverflow)?;
        self.set_liquidity_gross(new_gross);

        let current_net = self.get_liquidity_net();
        if is_lower {
            let new_net = current_net
                .checked_add(liquidity_delta)
                .ok_or(ClmmError::ArithmeticOverflow)?;
            self.set_liquidity_net(new_net);
        } else {
            let new_net = current_net
                .checked_sub(liquidity_delta)
                .ok_or(ClmmError::ArithmeticOverflow)?;
            self.set_liquidity_net(new_net);
        }
        Ok(())
    }

    pub fn update_liquidity_decrease(&mut self, liquidity_delta: i128, is_lower: bool) -> Result<()> {
        require!(self.initialized != 0, ClmmError::TickNotFound);

        let delta_abs = liquidity_delta.unsigned_abs();
        let current_gross = self.get_liquidity_gross();
        let new_gross = current_gross
            .checked_sub(delta_abs)
            .ok_or(ClmmError::ArithmeticOverflow)?;
        self.set_liquidity_gross(new_gross);

        let current_net = self.get_liquidity_net();
        if is_lower {
            let new_net = current_net
                .checked_sub(liquidity_delta)
                .ok_or(ClmmError::ArithmeticOverflow)?;
            self.set_liquidity_net(new_net);
        } else {
            let new_net = current_net
                .checked_add(liquidity_delta)
                .ok_or(ClmmError::ArithmeticOverflow)?;
            self.set_liquidity_net(new_net);
        }

        if new_gross == 0 {
            self.initialized = 0;
        }

        Ok(())
    }
}

pub const TICKS_PER_ARRAY: usize = 30;

#[account(zero_copy)]
#[repr(C)]
pub struct TickArray {
    pub pool: Pubkey,
    pub starting_tick: i32,
    pub bump: u8,
    pub _padding: [u8; 3],
    pub ticks: [TickInfo; TICKS_PER_ARRAY],
}

impl Default for TickArray {
    fn default() -> Self {
        Self {
            pool: Pubkey::default(),
            starting_tick: 0,
            bump: 0,
            _padding: [0; 3],
            ticks: [TickInfo::default(); TICKS_PER_ARRAY],
        }
    }
}

impl TickArray {
    pub fn get_starting_tick_index(tick: i32, tick_spacing: i32) -> i32 {
        let ticks_per_array_i32 = TICKS_PER_ARRAY as i32;
        let array_idx = tick
            .checked_div(tick_spacing)
            .expect("Div by zero: tick_spacing")
            .checked_div(ticks_per_array_i32)
            .expect("Div by zero: TICKS_PER_ARRAY");
        array_idx
            .checked_mul(ticks_per_array_i32)
            .expect("Mul overflow")
            .checked_mul(tick_spacing)
            .expect("Mul overflow")
    }

    pub fn get_tick_info_mutable(&mut self, tick: i32, tick_spacing: i32) -> Result<&mut TickInfo> {
        let ticks_per_array_i32 = TICKS_PER_ARRAY as i32;
        let offset = (tick
                .checked_div(tick_spacing)
                .ok_or(ClmmError::ArithmeticOverflow)?)
            .checked_sub(
                self.starting_tick
                    .checked_div(tick_spacing)
                    .ok_or(ClmmError::ArithmeticOverflow)?,
            )
            .ok_or(ClmmError::ArithmeticOverflow)?
            .checked_rem(ticks_per_array_i32)
            .ok_or(ClmmError::ArithmeticOverflow)? as usize;
        
        require!(offset < TICKS_PER_ARRAY, ClmmError::InvalidTickArrayIndex);
        Ok(&mut self.ticks[offset])
    }
}

// Simplified tick math
pub fn get_sqrt_price_from_tick(tick: i32) -> Result<u128> {
    let base_sqrt_price = 1u128 << 96;
    let adjustment_factor = 1_000_000_000 / 1000;
    let adjusted_price = base_sqrt_price
        .checked_add_signed((tick as i128) * (adjustment_factor as i128))
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

pub fn get_amounts_for_liquidity(
    current_sqrt_price_x96: u128,
    lower_sqrt_price_x96: u128,
    upper_sqrt_price_x96: u128,
    liquidity: u128,
) -> Result<(u64, u64)> {
    let amount0: u64;
    let amount1: u64;

    if current_sqrt_price_x96 >= lower_sqrt_price_x96
        && current_sqrt_price_x96 < upper_sqrt_price_x96
    {
        // Position is active - need both tokens
        amount0 = (liquidity.checked_div(1000).unwrap_or(0)) as u64;
        amount1 = (liquidity.checked_div(1000).unwrap_or(0)) as u64;
    } else if current_sqrt_price_x96 < lower_sqrt_price_x96 {
        // Price below range - only token0 needed
        amount0 = (liquidity.checked_div(1000).unwrap_or(0)) as u64;
        amount1 = 0;
    } else {
        // Price above range - only token1 needed
        amount0 = 0;
        amount1 = (liquidity.checked_div(1000).unwrap_or(0)) as u64;
    }
    Ok((amount0, amount1))
}

pub fn swap_segment(
    current_sqrt_price_x96: u128,
    global_liquidity: u128,
    amount_remaining_in: u64,
    swap_token_0_for_1: bool,
) -> Result<(u64, u64, u128)> {
    if global_liquidity == 0 {
        return Err(ClmmError::InsufficientLiquidity.into());
    }

    let amount_in_used = amount_remaining_in;
    // Simplified calculation with 0.1% fee
    let amount_out_calculated = amount_in_used
        .checked_sub(amount_in_used / 1000)
        .ok_or(ClmmError::ArithmeticOverflow)?;

    let new_sqrt_price = if swap_token_0_for_1 {
        current_sqrt_price_x96
            .checked_sub(1_000_000_000)
            .ok_or(ClmmError::ArithmeticOverflow)?
    } else {
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
    #[msg("Invalid Position Owner")]
    InvalidPositionOwner,
    #[msg("Invalid Position Range")]
    InvalidPositionRange,
    #[msg("Invalid Token Pair")]
    InvalidTokenPair,
    #[msg("Mint Range Must Cover Current Price")]
    MintRangeMustCoverCurrentPrice,
    #[msg("Burn Range Must Cover Current Price")]
    BurnRangeMustCoverCurrentPrice,
    #[msg("Insufficient Pool Liquidity")]
    InsufficientPoolLiquidity,
    #[msg("No Liquidity To Remove")]
    NoLiquidityToRemove,
    #[msg("Tick Not Found")]
    TickNotFound,
    #[msg("Invalid Tick Array Index")]
    InvalidTickArrayIndex,
}