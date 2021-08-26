import React, { Component } from 'react';
import classNames from 'classnames';
import ReactLoading from 'react-loading';

interface LoadingProps {
    loading: boolean
};
interface LoadingState {

};

export default class Loading extends Component<LoadingProps, LoadingState> {
    public static defaultProps = {
        loading: false
    };
    constructor(props: LoadingProps) {
        super(props);
    }
    render() {
        if (!this.props.loading) return null;
        return (
            <div className={
                    classNames("Loading h-100 w-100 d-flex justify-content-center align-items-center",
                        !this.props.loading && "d-none"
                    )}>
                <ReactLoading type="spin" color="#999"/>
            </div>
        );
    }
}