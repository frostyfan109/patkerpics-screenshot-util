import React, { Component, useState } from 'react';
import classNames from 'classnames';
import writtenForm from 'number-to-words';
import { applicationInterface, image as ImageType } from '../../store/reducers/application';
import './ImageContainer.css';
import { Card } from 'react-bootstrap';
import { Dropdown, DropdownMenu, DropdownToggle, DropdownItem } from 'reactstrap';
import { FaEllipsisV } from 'react-icons/fa';
import { withRouter } from 'react-router-dom';
import { RouteComponentProps } from 'react-router';
import Infinite from 'react-infinite';
import User from '../../api/user';

interface ThumbnailProps extends RouteComponentProps {
    image: ImageType
};

interface HookProps {
    imageId: number
};

class Hook extends Component<HookProps, {dropdownOpen: boolean}> {
    constructor(props: HookProps) {
        super(props);
        
        this.state = {
            dropdownOpen: false
        };

        this.toggleDropdown = this.toggleDropdown.bind(this);
    }
    public hideDropdown() {
        this.setState({ dropdownOpen: false });
    }
    private toggleDropdown() {
        this.setState({ dropdownOpen: !this.state.dropdownOpen });
    }
    render() {
        return (
            <Dropdown isOpen={this.state.dropdownOpen}
                      toggle={this.toggleDropdown}
                      className="kebab-container">
                <DropdownToggle className="" onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                }}>
                    <FaEllipsisV className="kebab"/>
                </DropdownToggle>
                <DropdownMenu>
                    <DropdownItem onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        User.deleteImage(this.props.imageId);
                    }}>Delete</DropdownItem>
                </DropdownMenu>
            </Dropdown>
        );
    }
}

const Thumbnail = withRouter(class extends Component<ThumbnailProps, {}> {
    private dropdownRef = React.createRef<Hook>();
    render() {
        return (
            <Card onClick={() => {
                this.props.history.push({
                    pathname : `/image/${this.props.image.id}`
                });
            }} onMouseLeave={() => {
                this.dropdownRef.current && this.dropdownRef.current.hideDropdown();
            }}>
                {/* <Card.Img variant="top" src={image.url}/> */}
                <div className="card-img-box" style={{
                    backgroundImage: `url(${this.props.image.url})`
                }}>
                    <Hook imageId={this.props.image.id} ref={this.dropdownRef}/>
                </div>
                <Card.Body>
                    <Card.Title title={this.props.image.title}>
                        {this.props.image.title}
                    </Card.Title>
                </Card.Body>
            </Card>
        );
    }
});

interface Props {
    images: applicationInterface["images"],
    className?: string
};

interface State {

};

export default class ImageContainer extends Component<Props, State> {
    render() {
        return (
            <div className={classNames("ImageContainer", this.props.className)}>
                {
                    this.props.images !== null && (this.props.images.length === 0 ? (
                        <div className="h-100 d-flex justify-content-center align-items-center">
                            <h6>No images</h6>
                        </div>
                    ) : (() => {
                        const images: ImageType[] = this.props.images as ImageType[];
                        interface ImageGroups {
                            [key: string]: ImageType[]
                        };
                        const imageGroups: ImageGroups = {};
                        images.sort((a, b) => b.timestamp - a.timestamp).forEach((image: ImageType, i) => {
                            const msInDay: number = 24 * 60 * 60 * 1000;
                                        
                            const timestamp: number = image.timestamp;
                            const currentTimestamp: number = Date.now();

                            const date = new Date(timestamp);
                            const currentDate = new Date();

                            const daysPassed = Math.floor((currentTimestamp - timestamp)/msInDay);
                            const daysInCurrentMonth = new Date(
                                currentDate.getFullYear(),
                                currentDate.getMonth() + 1,
                                0
                            ).getDate();
                            const daysInYear: number = 365;
                            let groupTitle: string;
                            if (daysPassed === 0) {
                                groupTitle = "Today";
                            }
                            else if (daysPassed < daysInCurrentMonth) {
                                groupTitle = "This month";
                            }
                            else if (daysPassed < daysInYear) {
                                groupTitle = date.toLocaleString("default", { month : "long" });
                            }
                            else {
                                const yearsPassed: number = new Date().getFullYear() - date.getFullYear();
                                const yearsWrittenForm: string = writtenForm.toWords(yearsPassed);
                                const yearsPassedString: string = yearsWrittenForm[0].toUpperCase() + yearsWrittenForm.slice(1);
                                groupTitle = yearsPassedString + " " + (yearsPassed > 1 ? "years" : "year") + " ago";
                            }
                            if (imageGroups.hasOwnProperty(groupTitle)) {
                                imageGroups[groupTitle].push(image);
                            }
                            else {
                                imageGroups[groupTitle] = [image];
                            }
                        });
                        // const chunk: number = 6;
                        // const imageGroups: ImageType[][] = images.map((image: ImageType, i) => {
                        //     return i % chunk === 0 ?
                        //         images.slice(i, i + chunk) :
                        //         null;
                        // }).filter((images: ImageType[]|null): images is ImageType[] => {
                        //     return images !== null;
                        // });
                        return Object.keys(imageGroups).map((title: string, i) => {
                            return (
                                <div className="image-grid-container" key={i}>
                                    <div className="h5 ml-1" style={{marginBottom: "0.75rem"}}>
                                    {(() => {
                                        return title;
                                        // new Date(imageGroup[0].timestamp).toLocaleString("default", { month : "long" })
                                    })()}
                                    </div>
                                    <div className="image-grid">
                                        {
                                            imageGroups[title].map((image: ImageType, i) => (
                                                <div key={image.id} className="image-container">
                                                    <Thumbnail image={image}/>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            );
                        });
                    })())
                }
            </div>
        );
    }
}