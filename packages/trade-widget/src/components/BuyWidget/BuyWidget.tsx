import { SignedOrder, ZeroEx } from '0x.js';
import { InjectedWeb3Subprovider, RedundantRPCSubprovider } from '@0xproject/subproviders';
import { AbiDecoder, BigNumber } from '@0xproject/utils';
import { Web3Wrapper } from '@0xproject/web3-wrapper';
import {
    Box,
    Button,
    Card,
    CardContent,
    CardHeaderTitle,
    Column,
    Columns,
    Container,
    Content,
    Control,
    Field,
    Image,
    Input,
    Label,
    Select,
    TextArea,
} from 'bloomer';
import 'bulma/css/bulma.css';
import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Web3 from 'web3';
import * as Web3ProviderEngine from 'web3-provider-engine';

import { artifacts } from '../../artifacts';
import { ForwarderWrapper } from '../../contract_wrappers/forwarder_wrapper';

import { Dispatcher } from '../../redux/dispatcher';
import {
    AccountTokenBalances,
    AccountWeiBalances,
    AssetToken,
    Quote,
    QuoteRequest,
    TokenBalances,
    TokenPair,
} from '../../types';
import AccountBlockie from '../AccountBlockie';
import TokenSelector from '../TokenSelector';

/* tslint:disable:prefer-function-over-method member-access */

interface BuyWidgetProps {
    onTokenChange?: (token: string) => any;
    onAmountChange?: (amount: BigNumber) => any;
    address: string;
    networkId: number;
    weiBalances: AccountWeiBalances;
    tokenBalances: AccountTokenBalances;
    selectedToken: AssetToken;
    web3Wrapper: Web3Wrapper;
    zeroEx: ZeroEx;
    dispatcher: Dispatcher;
    quote: Quote;
}

interface BuyWidgetState {
    amount?: BigNumber;
}

const ETH_DECIMAL_PLACES = 18;
class BuyWidget extends React.Component<BuyWidgetProps, BuyWidgetState> {
    private _forwarder: ForwarderWrapper;
    constructor(props: any) {
        super(props);
        this.state = {
            amount: new BigNumber(1),
        };

        this._handleAmountChange = this._handleAmountChange.bind(this);
        this._handleSubmitAsync = this._handleSubmitAsync.bind(this);
    }

    public async componentDidUpdate() {
        await this._quoteSelectedTokenAsync();
    }

    render() {
        const { address, weiBalances, tokenBalances, selectedToken, quote } = this.props;
        const tokenBalance = tokenBalances[address] ? tokenBalances[address][selectedToken] : new BigNumber(0);
        const weiBalance = weiBalances[address] || new BigNumber(0);
        return (
            <Content>
                <AccountBlockie
                    account={address}
                    weiBalance={weiBalance}
                    tokenBalance={tokenBalance}
                    selectedToken={selectedToken}
                />
                <Label isSize="small">SELECT TOKEN</Label>
                <Field isFullWidth={true}>
                    <TokenSelector
                        selectedToken={this.props.selectedToken}
                        onChange={this._handleTokenSelected.bind(this)}
                    />
                </Field>
                <Label style={{ marginTop: 30 }} isSize="small">
                    BUY AMOUNT
                </Label>
                <Field hasAddons={true}>
                    <Control isExpanded={true}>
                        <Input type="text" placeholder="1" onChange={this._handleAmountChange.bind(this)} />
                    </Control>
                    <Control>
                        <Select>
                            <option>ETH</option>
                            <option>ZRX</option>
                        </Select>
                    </Control>
                </Field>
                {/* <Field>
                    <strong> ESTIMATED COST </strong>
                </Field> */}
                <Field style={{ marginTop: 20 }}>
                    <Button
                        isLoading={_.isUndefined(quote)}
                        isFullWidth={true}
                        isColor="info"
                        onClick={this._handleSubmitAsync}
                    >
                        BUY TOKENS
                    </Button>
                </Field>
                <Field style={{ marginTop: 20 }} isGrouped={'centered'}>
                    <img style={{ marginLeft: '0px', height: '20px' }} src="/images/powered.png" />
                </Field>
            </Content>
        );
    }

    private async _handleSubmitAsync(event: any) {
        event.preventDefault();
        this.setState((prev, props) => {
            return { ...prev, isLoading: true };
        });
        const { address, quote } = this.props;
        const { amount } = this.state;
        const txHash = await this._fillOrderAsync(address, amount, quote.orders[0]);
        this.setState((prev, props) => {
            return { ...prev, isLoading: false };
        });
    }

    private _handleAmountChange(event: any) {
        event.preventDefault();
        const rawValue = event.target.value;
        let value: undefined | BigNumber;
        if (!_.isUndefined(rawValue) && !_.isEmpty(rawValue)) {
            const ethValue = new BigNumber(rawValue);
            const fillAmount = ZeroEx.toBaseUnitAmount(ethValue, ETH_DECIMAL_PLACES);
            value = fillAmount;
            this.setState((prev, props) => {
                return { ...prev, amount: value };
            });
            this._quoteSelectedTokenAsync().catch(console.log);
        }
    }

    private _handleTokenSelected(token: AssetToken) {
        this.props.dispatcher.updateSelectedToken(token);
    }

    private async _fillOrderAsync(
        takerAddress: string,
        fillAmount: BigNumber,
        signedOrder: SignedOrder,
    ): Promise<string> {
        const txHash = await this._getForwarder().fillOrderAsync(signedOrder, fillAmount, takerAddress);
        this.props.dispatcher.transactionSubmitted(txHash);
        const receipt = await this.props.zeroEx.awaitTransactionMinedAsync(txHash);
        this.props.dispatcher.transactionMined(receipt);
        return txHash;
    }

    private _getForwarder(): ForwarderWrapper {
        const artifactJSONs = _.values(artifacts);
        const abiArrays = _.map(artifactJSONs, artifact => artifact.networks[this.props.networkId].abi);
        const abiDecoder = new AbiDecoder(abiArrays);
        this._forwarder = new ForwarderWrapper(this.props.web3Wrapper, this.props.networkId, abiDecoder);
        return this._forwarder;
    }

    private async _quoteSelectedTokenAsync() {
        const { amount } = this.state;
        const { selectedToken, quote } = this.props;
        if (_.isUndefined(quote) || quote.pair.maker !== selectedToken) {
            const tokenPair: TokenPair = { maker: selectedToken, taker: AssetToken.WETH };
            this.props.dispatcher.quoteRequested(amount, tokenPair);
        }
    }
}

// tslint:disable-next-line:no-default-export
export { BuyWidget };